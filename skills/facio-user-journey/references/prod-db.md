# Prod DB Deep-Dive (Tier 2 — engineers only)

Adds what Mixpanel cannot see: what the user **said** to the AI, what the AI **built**, credit spend.

**Do not start here.** Run Tier 1 first. The DB has no export/activation record — if you come here
looking for "did they finish a video", you are in the wrong place.

## Red lines

1. **Reader endpoint only.** This is an investigation, never a write.
2. **Least privilege.** Use the app runtime role. Do **not** reach for the cluster master secret.
3. **Password in memory only.** Never write a secret to disk, never echo it.
4. **Nothing hardcoded.** No ARNs, no endpoints, no account ids — discover them. This file lives in
   a public repo.
5. **Delete dumps when done.** They contain PII.

## Discovery — one call gives you endpoint AND secret

`describe-db-clusters` returns the reader endpoint and the master secret ARN together, so nothing
needs to be written down:

```bash
REGION=us-west-2
aws rds describe-db-clusters --region $REGION \
  --query "DBClusters[?contains(DBClusterIdentifier,'prod')].{id:DBClusterIdentifier,reader:ReaderEndpoint}" \
  --output json
```

Pick the facio prod cluster's **`reader`** (the `cluster-ro-` host). The staging cluster is separate.

Credentials — prefer the **app runtime role**, not the master:

```bash
aws secretsmanager list-secrets --region $REGION --query "SecretList[].Name" --output text | tr '\t' '\n' | grep -i 'db-app'
```

> The migrator role has schema visibility but **`permission denied for table auth_identity`** on
> real queries. The app role is both sufficient and least-privilege. Use it.

## Tunnel

Any online SSM instance works as a jump host; no SSH key needed.

```bash
TARGET=$(aws ssm describe-instance-information --region $REGION \
  --query "InstanceInformationList[?PingStatus=='Online']|[0].InstanceId" --output text)

aws ssm start-session --region $REGION --target "$TARGET" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "{\"host\":[\"$READER\"],\"portNumber\":[\"5432\"],\"localPortNumber\":[\"15432\"]}" &
sleep 5
```

**Prod RDS requires SSL.** `PGSSLMODE=disable` fails with `no pg_hba.conf entry ... no encryption`.
Use `PGSSLMODE=require`. Kill the tunnel when done.

**The secret has no `dbname` field** — don't guess the database, list it (the prod DB is *not* the
same name as the staging one, so a guess costs you a failed connection):

```bash
psql "host=localhost port=15432 user=$U dbname=postgres sslmode=require" \
  -tAc "select datname from pg_database where datistemplate=false;"
```

## Where things actually live

| Looking for | Reality |
|---|---|
| Email | **Not on `account`.** It is `auth_identity.email` — join on `auth_identity.account_id = account.id`. |
| Invited but never signed up | **Not here.** `waitlist` in prod is empty by design; that pipeline is the **admin-server** DB. |
| AI-generated effects | `conversation_message.tool_calls` where `name = 'commit_effect'`. **`remotion_effect` is empty** for real accounts. |
| Export / render record | **Does not exist in Postgres.** Client event only (Tier 1). |
| `reamp_task` | A different feature (video remix). Empty for chat-editing users — not a signal. |
| `account.last_login_at` | Not refreshed on every session. **Do not read it as last activity** — use Mixpanel `$last_seen`. |

Confirm column names with `\d <table>` before querying. Guessing costs more than checking.

## Queries

```sql
-- identity (email is on auth_identity, NOT account)
select ai.account_id, ai.provider, ai.email, ai.email_verified,
       a.status, a.created_at as account_created
from auth_identity ai join account a on a.id = ai.account_id
where lower(ai.email) = lower('<EMAIL>');

-- credit spend, grouped by what it bought
select op_type, entry_type, count(*), sum(amount)
from credits_ledger where account_id = '<ACCOUNT_ID>'
group by op_type, entry_type order by 4 desc;

-- conversations incl. the parent/child hierarchy
select id::text, agent_type, status, last_state, message_count,
       created_at, metadata->>'parent_session_id' as parent
from conversation where account_id = '<ACCOUNT_ID>' order by created_at;

-- what the user actually asked for (their own words)
select c.id::text, m.created_at, m.content
from conversation_message m join conversation c on c.id = m.conversation_id
where c.account_id = '<ACCOUNT_ID>' and m.role = 'user'
order by m.created_at;

-- AI-generated effects: args carry component+props, the result carries ids
select m.tool_name, m.tool_calls, m.content
from conversation_message m join conversation c on c.id = m.conversation_id
where c.account_id = '<ACCOUNT_ID>' and m.tool_name = 'commit_effect'
order by m.created_at;
```

## Conversation hierarchy

Linked by `conversation.metadata->>'parent_session_id'`:

```
main session (uuid)
└── ws_*   orchestration  (dispatch_to_capability: add_effects)
    ├── pk_* / pp_*  dispatch bookkeeping
    └── eg_*  one per effect — each commits exactly ONE effect
```

Counting effects from the main session alone **undercounts** — walk the children. Sub-sessions
sitting in `active` / `thinking` are usually just where the user closed the app, **not** an error:
verify by checking whether any tool call actually returned `success: false` before calling it a bug.
