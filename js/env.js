// Worker (API) ka URL. Pehle workers.dev wala dalo, subdomain add hone ke baad api.tumhara-domain.com
export const API = ['localhost','127.0.0.1'].includes(location.hostname)
  ? 'http://localhost:8787'
  : 'https://apex-rush-api.YOUR-NAME.workers.dev';
