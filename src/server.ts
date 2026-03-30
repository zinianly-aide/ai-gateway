import { buildApp } from './app.js';

const port = Number(process.env.PORT || 3000);

buildApp()
  .then((app) => app.listen({ host: '0.0.0.0', port }))
  .then(() => {
    console.log(`ai-gateway running on :${port}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
