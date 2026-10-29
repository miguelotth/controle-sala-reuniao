// O .env tem prioridade sobre variáveis já definidas no sistema
require("dotenv").config({ override: true });

const app = require("./app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
