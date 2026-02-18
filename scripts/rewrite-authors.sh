#!/bin/sh
# Rewrite commit history to replace unwanted author/committer identities.
# WARNING: This rewrites history. Only run if you understand force-pushing will be required.

OLD_NAME="Hanze Li"
OLD_EMAIL="109655023+Maotechh@users.noreply.github.com"
CORRECT_NAME="MaoTechh"
CORRECT_EMAIL="MaoTechMail@gmail.com"

echo "This will rewrite all commits authored or committed by:\n  $OLD_NAME <$OLD_EMAIL>\ninto:\n  $CORRECT_NAME <$CORRECT_EMAIL>"
read -p "Proceed? (type 'yes' to continue): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Aborted by user.";
  exit 1
fi

git reflog expire --expire=now --all
git gc --prune=now --aggressive

git filter-branch --env-filter '
if [ "$GIT_COMMITTER_EMAIL" = "'"$OLD_EMAIL"'" ] || [ "$GIT_COMMITTER_NAME" = "'"$OLD_NAME"'" ]; then
    export GIT_COMMITTER_NAME="'"$CORRECT_NAME"'"
    export GIT_COMMITTER_EMAIL="'"$CORRECT_EMAIL"'"
fi
if [ "$GIT_AUTHOR_EMAIL" = "'"$OLD_EMAIL"'" ] || [ "$GIT_AUTHOR_NAME" = "'"$OLD_NAME"'" ]; then
    export GIT_AUTHOR_NAME="'"$CORRECT_NAME"'"
    export GIT_AUTHOR_EMAIL="'"$CORRECT_EMAIL"'"
fi
' -- --all

echo "Rewrite complete. Review the history, then force-push with:\n  git push --force-with-lease origin <branch>"
