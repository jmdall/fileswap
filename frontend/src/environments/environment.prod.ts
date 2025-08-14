// Configuration pour la production
// Ces valeurs seront remplacées au build par Vercel

export const environment = {
  production: true,
  // Les URLs seront injectées au build via le script de configuration
  apiUrl: '${API_URL}',
  wsUrl: '${WS_URL}'
};
