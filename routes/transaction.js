const express = require('express');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path')
const { check, validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const authMiddleware = require('../middlewares/authMiddleware');
const otpGenerator = require('../utils/otpGenerator');
const responseController = require('../utils/responseController');
const router = express.Router();
const app = express();


app.use(morgan('combined'));

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


// Путь к лог-файлу
const logDirectory = './logs/';
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
}

const logFilePath = path.join(logDirectory, 'face_transactions.log');

// Транзакция с помощью face_id
router.post('/face', authMiddleware, [
    check('name', 'Name is required').not().isEmpty(),
    check('image_path', 'Image path is required').not().isEmpty(),
    check('label', 'Label is required').not().isEmpty(),
    check('amount', 'Amount is required').not().isEmpty(),
    check('description', 'Description should not be greater than 255 characters').isLength({ max: 255 })
], async (req, res) => {
    const errors = validationResult(req);
    const { name, image_path, label, amount, description } = req.body;
    const otp = otpGenerator();
    const logEntry = `Transaction attempt: name=${name}, image_path=${image_path}, label=${label}, user_id=${req.user.userId}, amount=${amount}, description=${description}, time=${new Date().toISOString()}\n`;

    // Записываем лог ошибки валидации, если есть
    if (!errors.isEmpty()) {
        fs.appendFile(logFilePath, `Validation error: ${errors.array()[0].msg}, logEntry=${logEntry}`, (err) => {
            if (err) console.error('Failed to write to log file', err);
        });
        return res.status(200).json(responseController.errorResponse(errors.array()[0].msg));
    }

    try {
        // Попытка создания транзакции
        const transaction = await Transaction.create({ amount, description, otp, type: 'face', image_path, userId: req.user.userId });

        // Записываем лог успешной транзакции
        fs.appendFile(logFilePath, `Success: ${logEntry}`, (err) => {
            if (err) console.error('Failed to write to log file', err);
        });

        res.status(200).json(responseController.successResponse('Transaction created successfully', {
            transaction_id: transaction.id, status: transaction.status, otp_code: otp, type: transaction.type
        }));
    } catch (err) {
        // Записываем лог ошибки сервера
        fs.appendFile(logFilePath, `Server error: ${err.message} user_id=${req.user.userId}, time=${new Date().toISOString()}\n`, (err) => {
            if (err) console.error('Failed to write to log file', err);
        });
        res.status(500).json(responseController.errorResponse('Server error'));
    }
});

module.exports = router;
