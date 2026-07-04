const express = require("express");
const { login, me, register, uploadPhoto } = require("../controllers/auth.controller");
const { requireAuth } = require("../jwt");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, me);
router.patch("/profile/photo", requireAuth, uploadPhoto);

module.exports = router;
