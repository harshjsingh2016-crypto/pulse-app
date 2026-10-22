#!/usr/bin/env bash
# Run:  firebase emulators:exec --only firestore "bash scripts/test-rules.sh"
# Exercises firestore.rules against the local emulator over REST with unsigned JWTs
# (the emulator accepts alg=none tokens). Prints PASS/FAIL per case.
set -u
P=pulse-app-28aba
BASE="http://127.0.0.1:8080/v1/projects/$P/databases/(default)/documents"
b64() { printf '%s' "$1" | base64 | tr '+/' '-_' | tr -d '=\n'; }
tok() { # $1 = uid
  local h p now exp
  now=$(date +%s); exp=$((now+3600))
  h=$(b64 '{"alg":"none","typ":"JWT"}')
  p=$(b64 "{\"sub\":\"$1\",\"user_id\":\"$1\",\"uid\":\"$1\",\"iss\":\"https://securetoken.google.com/$P\",\"aud\":\"$P\",\"auth_time\":$now,\"iat\":$now,\"exp\":$exp,\"firebase\":{\"sign_in_provider\":\"custom\"}}")
  printf '%s.%s.' "$h" "$p"
}
A=$(tok userA); B=$(tok userB)
ADMIN="owner"   # emulator bypass token, used to seed data
fail=0
check() { # $1 label  $2 expected http code  $3.. curl args
  local label=$1 want=$2; shift 2
  local got; got=$(curl -s -o /dev/null -w '%{http_code}' "$@")
  if [ "$got" = "$want" ]; then echo "PASS  $label ($got)"; else echo "FAIL  $label (want $want, got $got)"; fail=1; fi
}
J='Content-Type: application/json'

# Seed with admin: user docs, a limits doc, a chat message, a task for A.
curl -s -o /dev/null -X PATCH "$BASE/users/userA" -H "Authorization: Bearer $ADMIN" -H "$J" -d '{"fields":{"email":{"stringValue":"a@x"},"chat_provider":{"stringValue":"claude"}}}'
curl -s -o /dev/null -X PATCH "$BASE/users/userA/limits/2026-10-22" -H "Authorization: Bearer $ADMIN" -H "$J" -d '{"fields":{"chat_count":{"integerValue":"9"}}}'
curl -s -o /dev/null -X PATCH "$BASE/users/userA/usage/2026-10-22" -H "Authorization: Bearer $ADMIN" -H "$J" -d '{"fields":{"cost_usd":{"doubleValue":1.5}}}'
curl -s -o /dev/null -X PATCH "$BASE/users/userA/chat_threads/main/messages/m1" -H "Authorization: Bearer $ADMIN" -H "$J" -d '{"fields":{"role":{"stringValue":"assistant"},"content":{"stringValue":"hi"}}}'
curl -s -o /dev/null -X PATCH "$BASE/users/userA/tasks/t1" -H "Authorization: Bearer $ADMIN" -H "$J" -d '{"fields":{"title":{"stringValue":"x"}}}'

echo "--- isolation"
check "A reads own task"            200 "$BASE/users/userA/tasks/t1" -H "Authorization: Bearer $A"
check "B cannot read A's task"      403 "$BASE/users/userA/tasks/t1" -H "Authorization: Bearer $B"
check "anon cannot read A's task"   403 "$BASE/users/userA/tasks/t1"
check "B cannot write A's task"     403 -X PATCH "$BASE/users/userA/tasks/t1" -H "Authorization: Bearer $B" -H "$J" -d '{"fields":{"title":{"stringValue":"pwned"}}}'
check "A writes own task"           200 -X PATCH "$BASE/users/userA/tasks/t1" -H "Authorization: Bearer $A" -H "$J" -d '{"fields":{"title":{"stringValue":"mine"}}}'

echo "--- cost caps"
check "A cannot reset limits"       403 -X PATCH "$BASE/users/userA/limits/2026-10-22" -H "Authorization: Bearer $A" -H "$J" -d '{"fields":{"chat_count":{"integerValue":"0"}}}'
check "A cannot delete limits"      403 -X DELETE "$BASE/users/userA/limits/2026-10-22" -H "Authorization: Bearer $A"
check "A can read limits"           200 "$BASE/users/userA/limits/2026-10-22" -H "Authorization: Bearer $A"
check "A cannot write usage"        403 -X PATCH "$BASE/users/userA/usage/2026-10-22" -H "Authorization: Bearer $A" -H "$J" -d '{"fields":{"cost_usd":{"doubleValue":0}}}'
check "A cannot raise own limit"    403 -X PATCH "$BASE/users/userA?updateMask.fieldPaths=daily_message_limit" -H "Authorization: Bearer $A" -H "$J" -d '{"fields":{"daily_message_limit":{"integerValue":"100000"}}}'
check "A can switch provider"       200 -X PATCH "$BASE/users/userA?updateMask.fieldPaths=chat_provider" -H "Authorization: Bearer $A" -H "$J" -d '{"fields":{"chat_provider":{"stringValue":"openai"}}}'
check "new user B doc w/o limit"    200 -X PATCH "$BASE/users/userB" -H "Authorization: Bearer $B" -H "$J" -d '{"fields":{"email":{"stringValue":"b@x"}}}'
check "new user C doc WITH limit"   403 -X PATCH "$BASE/users/userC" -H "Authorization: Bearer $(tok userC)" -H "$J" -d '{"fields":{"email":{"stringValue":"c@x"},"daily_message_limit":{"integerValue":"999"}}}'

echo "--- chat history"
check "A reads messages"            200 "$BASE/users/userA/chat_threads/main/messages/m1" -H "Authorization: Bearer $A"
check "A cannot create message"     403 -X PATCH "$BASE/users/userA/chat_threads/main/messages/m2" -H "Authorization: Bearer $A" -H "$J" -d '{"fields":{"role":{"stringValue":"user"},"content":{"stringValue":"huge"}}}'
check "A cannot edit content"       403 -X PATCH "$BASE/users/userA/chat_threads/main/messages/m1?updateMask.fieldPaths=content" -H "Authorization: Bearer $A" -H "$J" -d '{"fields":{"content":{"stringValue":"edited"}}}'
check "A marks applied_actions"     200 -X PATCH "$BASE/users/userA/chat_threads/main/messages/m1?updateMask.fieldPaths=applied_actions" -H "Authorization: Bearer $A" -H "$J" -d '{"fields":{"applied_actions":{"arrayValue":{"values":[{"integerValue":"0"}]}}}}'
check "A cannot delete message"     403 -X DELETE "$BASE/users/userA/chat_threads/main/messages/m1" -H "Authorization: Bearer $A"

echo "--- recurring completions"
check "create with matching id"     200 -X PATCH "$BASE/users/userA/recurring_completions/r1_2026-10-22" -H "Authorization: Bearer $A" -H "$J" -d '{"fields":{"task_id":{"stringValue":"r1"},"date":{"stringValue":"2026-10-22"}}}'
check "create with wrong id"        403 -X PATCH "$BASE/users/userA/recurring_completions/other" -H "Authorization: Bearer $A" -H "$J" -d '{"fields":{"task_id":{"stringValue":"r1"},"date":{"stringValue":"2026-10-22"}}}'
check "delete own completion"       200 -X DELETE "$BASE/users/userA/recurring_completions/r1_2026-10-22" -H "Authorization: Bearer $A"

echo "--- pre-auth collection"
check "anon cannot read email_otps" 403 "$BASE/email_otps/abc"
check "A cannot read email_otps"    403 "$BASE/email_otps/abc" -H "Authorization: Bearer $A"

exit $fail
