export const loadDefaults = {
  apiUrl: 'http://localhost:4001/api',
  soakSeconds: 7_200,
};

export const loadConfig = {
  apiUrl: process.env.LOAD_API_URL || loadDefaults.apiUrl,
  soakSeconds: Number(process.env.SOAK_SECONDS) || loadDefaults.soakSeconds,
};
