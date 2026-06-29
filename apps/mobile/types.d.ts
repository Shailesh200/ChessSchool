// EXPO_PUBLIC_* env vars are inlined by the bundler as process.env.X.
declare const process: {
  env: { EXPO_PUBLIC_API_URL?: string } & Record<string, string | undefined>;
};
