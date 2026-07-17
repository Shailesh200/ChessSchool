# Upload the production AAB (manual)

Built locally (no EAS queue):

```
apps/mobile/dist/chessschool-release.aab
```

Signed with the Expo-managed upload keystore (`tsgLua-5VY`). Package: `com.chessschool.app`.

## Play Console steps

1. Sign in at https://play.google.com/console
2. Create the app if needed (name **ChessSchool**, package **com.chessschool.app**, free, Education)
3. Complete **Store listing** using [LISTING.md](LISTING.md) + graphics in this folder
4. Complete **Privacy policy**, **Data safety**, **Content rating**, **Target audience**
5. **Release → Testing → Internal testing → Create new release**
6. Upload `dist/chessschool-release.aab`
7. Add yourself (and testers) to the internal testing email list
8. Roll out → install via the internal testing opt-in link
9. Run [SMOKE_QA.md](SMOKE_QA.md)
10. Promote to **Production** when smoke passes

## Optional: wire EAS Submit later

```bash
cd apps/mobile
npx eas-cli credentials   # Android → Google Service Account Key
pnpm submit:android:internal:local
```
