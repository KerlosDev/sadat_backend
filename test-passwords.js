const mongoose = require('mongoose');
const { connectMongoDB } = require('./config/database');
const { Admin, Doctor, Student } = require('./models');

const testPasswords = async () => {
    try {
        await connectMongoDB();

        // Get the super admin
        const admin = await Admin.findOne({ email: 'admin@university.edu' });
        console.log('Admin password hash:', admin.password);
        console.log('Admin password length:', admin.password.length);
        console.log('Is bcrypt hash format:', admin.password.startsWith('$2'));

        // Test password comparison
        const isValidPassword = await admin.comparePassword('admin123');
        console.log('Password validation works:', isValidPassword);

        // Get a doctor
        const doctor = await Doctor.findOne({ email: 'doctor1@university.edu' });
        console.log('\nDoctor password hash:', doctor.password);
        console.log('Doctor password validation:', await doctor.comparePassword('doctor123'));

        // Get a student
        const student = await Student.findOne({ email: 'student1@university.edu' });
        console.log('\nStudent password hash:', student.password);
        console.log('Student password validation:', await student.comparePassword('student123'));

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

testPasswords();