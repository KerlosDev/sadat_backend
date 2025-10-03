const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// MongoDB connection using Mongoose
const connectMongoDB = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/university_erp';
        console.log('Connecting to MongoDB with URI:', mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//[username]:[password]@'));

        await mongoose.connect(mongoUri);
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

// Test MongoDB connection
const testConnection = async () => {
    try {
        const connection = mongoose.connection;
        connection.on('connected', () => {
            console.log('MongoDB connection has been established successfully.');
        });
        connection.on('error', (error) => {
            console.error('MongoDB connection error:', error);
        });
    } catch (error) {
        console.error('Unable to connect to MongoDB database:', error);
    }
};

module.exports = {
    connectMongoDB,
    testConnection,
};