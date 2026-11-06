# Account emails

Branded templates for the three emails the site sends. Supabase fills in the
`{{ .ConfirmationURL }}`, `{{ .Email }}` and `{{ .NewEmail }}` parts.

Paste each one in Supabase: **Authentication → Emails → Templates**. For each
template, set the subject, switch the body to the source/HTML view, delete
what's there, paste the whole file and click **Save**.

| Supabase template    | File                  | Subject                                              |
| -------------------- | --------------------- | ---------------------------------------------------- |
| Confirm sign up      | `confirm-signup.html` | Confirm your email address · Shiur Daled Mivtzoim    |
| Reset password       | `reset-password.html` | Reset your password · Shiur Daled Mivtzoim           |
| Change email address | `change-email.html`   | Confirm your new email address · Shiur Daled Mivtzoim |

Also, under **Authentication → Emails → SMTP Settings**, set **Sender name**
to `Shiur Daled Mivtzoim` so inboxes show that instead of the Gmail address.
