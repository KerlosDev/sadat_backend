const mongoose = require('mongoose');
require('dotenv').config();
const { Student } = require('../models');

async function checkStudentQRCode() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to database');

        // Get student STU000388
        const student = await Student.findOne({ studentNumber: 'STU000388' }).select('_id studentNumber qrCode name');

        if (student) {
            console.log('Student found:', student.name, student.studentNumber);
            console.log('QR Code field type:', typeof student.qrCode);
            console.log('QR Code starts with:', student.qrCode.substring(0, 100));
            console.log('Is it base64 image?', student.qrCode.startsWith('data:image/'));

            if (!student.qrCode.startsWith('data:image/')) {
                console.log('QR Code seems to be JSON data');
                try {
                    const parsed = JSON.parse(student.qrCode);
                    console.log('Parsed QR data:', parsed);
                } catch (error) {
                    console.log('Failed to parse QR code as JSON:', error.message);
                }
            }
        } else {
            console.log('Student not found');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from database');
    }
}

checkStudentQRCode();