const express = require('express');
const { check, validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const authMiddleware = require('../middlewares/authMiddleware');
const otpGenerator = require('../utils/otpGenerator');
const router = express.Router();

// Создание транзакции
router.post('/create', authMiddleware, [
    check('amount', 'Amount is required').not().isEmpty(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { amount, description } = req.body;
    const otp = otpGenerator();

    try {
        const transaction = await Transaction.create({ amount, description, otp, userId: req.user.id });
        res.json({ transaction_id: transaction.id, status: transaction.status, otp });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// Подтверждение транзакции
router.post('/confirm', authMiddleware, async (req, res) => {
    const { transaction_id, otp } = req.body;

    try {
        const transaction = await Transaction.findByPk(transaction_id);
        if (!transaction) return res.status(404).json({ msg: 'Transaction not found' });

        if (transaction.otp === otp) {
            transaction.status = 'confirmed';
        } else {
            transaction.status = 'failed';
        }
        await transaction.save();
        res.json({ status: transaction.status });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

// Отмена транзакции
router.post('/cancel', authMiddleware, async (req, res) => {
    const { transaction_id } = req.body;

    try {
        const transaction = await Transaction.findByPk(transaction_id);
        if (!transaction) return res.status(404).json({ msg: 'Transaction not found' });

        transaction.status = 'cancelled';
        await transaction.save();
        res.json({ status: transaction.status });
    } catch (err) {
        res.status(500).send('Server error');
    }
});

module.exports = router;
