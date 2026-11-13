# Sign in with Apple — decision

**Add Sign in with Apple before submitting this binary to App Store review.** It is not in the app today, and this release does not add it.

Guideline 4.8 applies. The iOS production build offers a third-party login for the primary account: "Continue with Google" (`@react-native-google-signin/google-signin`). The production EAS profile sets `EXPO_PUBLIC_GOOGLE_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, and the sign-in screen shows the Google button when that native module is in the binary. Email and password are also offered. Apple still requires an equivalent login when a social login such as Google is offered. Equivalent means the option limits itself to name and email, lets the person hide their email, and does not collect interactions for advertising without consent. Sign in with Apple is the option that meets that bar.

Hiding Google on iOS would also take the binary out of 4.8, because email and password alone do not trigger it. That is a product cut, not the recommendation. The Play build can keep Google sign-in; Play has no 4.8 rule.

Do not ship the iOS build to review until one of those two changes is in the binary. No Apple sign-in code, entitlement, or dependency is added here.
