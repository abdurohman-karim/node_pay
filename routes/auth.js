const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const User = require('../models/User');
const { Op } = require('sequelize');
const responseController = require('../utils/responseController');


require('dotenv').config();
const router = express.Router();

router.post('/register', [
    check('email', 'Invalid email').isEmail(),
    check('password', 'Password must be 6+ characters').isLength({ min: 6 }),
    check('username', 'Username is required').exists(),
    check('first_name', 'First name is required').exists(),
    check('last_name', 'Last name is required').exists(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { username, email, password, first_name, last_name } = req.body;

    try {
        const existingUser = await User.findOne({ where: { [Op.or]: [{ username }, { email }] } });

        if (existingUser) {
            return res.status(200).json(responseController.errorResponse('User already exists'));
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ username, email, password: hashedPassword, first_name, last_name });

        // Create and assign a token
        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json(responseController.successResponse('User created', { token }));
    } catch (err) {
        console.error(err);
        res.status(500).json(responseController.errorResponse('Server error'));
    }
});


router.post('/login', [
    check('email', 'Invalid email').isEmail(),
    check('password', 'Password is required').exists(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json(responseController.errorResponse(errors.array()[0].msg));

    const { email, password } = req.body;
    try {
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(400).json(responseController.errorResponse('User not found'));

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json(responseController.errorResponse('Incorrect password'));

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json(responseController.successResponse('Login successful', { token }));
    } catch (err) {
        res.status(500).json(responseController.errorResponse('Server error'));
    }
});

module.exports = router;
