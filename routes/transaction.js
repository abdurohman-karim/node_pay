const express = require('express');
const { check, validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const authMiddleware = require('../middlewares/authMiddleware');
const otpGenerator = require('../utils/otpGenerator');
const responseController = require('../utils/responseController');
const router = express.Router();

// Создание транзакции
router.post('/create', authMiddleware, [
    check('amount', 'Amount is required').not().isEmpty(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json(responseController.errorResponse(errors.array()[0].msg));

    const { amount, description } = req.body;
    const otp = otpGenerator();

    try {
        const transaction = await Transaction.create({ amount, description, otp, userId: req.user.userId });
        res.json(responseController.successResponse('Transaction created successfully',{ transaction_id: transaction.id, status: transaction.status, otp }));
    } catch (err) {
        res.status(500).json(responseController.errorResponse('Server error'));
    }
});

// Подтверждение транзакции
router.post('/confirm', authMiddleware, async (req, res) => {
    const { transaction_id, otp } = req.body;

    try {
        const transaction = await Transaction.findByPk(transaction_id);
        if (!transaction) return res.status(404).json(responseController.errorResponse('Transaction not found'));

        if (transaction.otp === otp) {
            transaction.status = 'confirmed';
        } else {
            transaction.status = 'pending';
        }
        await transaction.save();
        res.json(responseController.successResponse('Transaction confirmed successfully', { status: transaction.status }));
    } catch (err) {
        res.status(500).json(responseController.errorResponse('Server error'));
    }
});

// Отмена транзакции
router.post('/cancel', authMiddleware, async (req, res) => {
    const { transaction_id } = req.body;

    try {
        const transaction = await Transaction.findByPk(transaction_id);
        if (!transaction) return res.status(404).json(responseController.errorResponse('Transaction not found'));

        if (transaction.status === 'cancelled') {
            return res.status(400).json(responseController.errorResponse('Transaction already cancelled'));
        } else if (transaction.status === 'failed') {
            return res.status(400).json(responseController.errorResponse('Cannot cancel a transaction'));
        }

        transaction.status = 'cancelled';
        await transaction.save();
        res.json(responseController.successResponse('Transaction cancelled successfully', { status: transaction.status }));
    } catch (err) {
        res.status(500).json(responseController.errorResponse('Server error'));
    }
});

module.exports = router;
