const express = require("express");
const router = express.Router();

const reservasController = require("../controllers/reservasController");

router.get("/", reservasController.listarReservas);

router.get("/:id", reservasController.buscarReservaPorId);

router.post("/", reservasController.criarReserva);

router.post("/prioridade", reservasController.aplicarPrioridade);

router.put("/:id", reservasController.editarReserva);

router.patch("/:id/standby", reservasController.pausarReserva);

router.patch("/:id/retomar", reservasController.retomarReserva);

router.patch("/:id/encerrar", reservasController.encerrarReserva);

router.patch("/:id/estender", reservasController.estenderReserva);

router.patch("/:id/cancelar", reservasController.cancelarReserva);

module.exports = router;