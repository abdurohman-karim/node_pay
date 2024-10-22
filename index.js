const express = require('express');
const sequelize = require('./models/index');  // Импортируем sequelize
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transaction');

const app = express();

app.use(express.json());

// Подключаем маршруты
app.use('/api', authRoutes);
app.use('/api/transactions', transactionRoutes);

// Миграции базы данных
sequelize.sync({ force: false })  // Создание таблиц на основе моделей
    .then(() => {
        console.log('Database & tables created!');
    })
    .catch(err => {
        console.error('Unable to sync the database:', err);
    });

// Запуск сервера
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`));
