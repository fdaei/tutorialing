export const scriptDefaults = {
  apiUrl: 'http://localhost:4001',
};

export const scriptConfig = {
  apiUrl: process.env.API_URL || scriptDefaults.apiUrl,
};
