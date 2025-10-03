const mongoose = require('mongoose');
require('dotenv').config();
const { Student } = require('../models');
const QRService = require('../services/qrService');

async function fixStudentQRCodes() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to database');

        // Get all students
        const students = await Student.find({}).select('_id studentNumber qrCode name');
        console.log(`Found ${students.length} students to update`);

        let updated = 0;
        let skipped = 0;

        for (const student of students) {
            try {
                let needsUpdate = false;
                let qrCodeData = student.qrCode;

                // Check if qrCode is base64 image
                if (student.qrCode && student.qrCode.startsWith('data:image/')) {
                    needsUpdate = true;
                    console.log(`Student ${student.name} (${student.studentNumber}) has base64 QR code, converting to JSON data`);
                } else if (student.qrCode) {
                    // Try to parse existing JSON data
                    try {
                        const parsedData = JSON.parse(student.qrCode);

                        // Check if studentId is null, missing, or temp_id
                        if (!parsedData.studentId || parsedData.studentId === 'temp_id' || parsedData.studentId === null) {
                            needsUpdate = true;
                            console.log(`Student ${student.name} (${student.studentNumber}) has invalid studentId: ${parsedData.studentId}`);
                        }
                    } catch (parseError) {
                        needsUpdate = true;
                        console.log(`Student ${student.name} (${student.studentNumber}) has invalid QR code JSON`);
                    }
                } else {
                    needsUpdate = true;
                    console.log(`Student ${student.name} (${student.studentNumber}) has no QR code`);
                }

                if (needsUpdate) {
                    // Generate new QR code data with correct studentId
                    const newQrData = QRService.generateStudentQRData(student._id, student.studentNumber);

                    // Update the student
                    await Student.findByIdAndUpdate(student._id, { qrCode: newQrData });

                    console.log(`✅ Updated QR code for ${student.name} (${student.studentNumber})`);
                    updated++;
                } else {
                    console.log(`⏭️  Skipped ${student.name} (${student.studentNumber}) - QR code is already correct`);
                    skipped++;
                }
            } catch (error) {
                console.error(`❌ Error updating student ${student.name} (${student.studentNumber}):`, error.message);
            }
        }

        console.log('\n=== Update Summary ===');
        console.log(`Total students: ${students.length}`);
        console.log(`Updated: ${updated}`);
        console.log(`Skipped: ${skipped}`);
        console.log(`Errors: ${students.length - updated - skipped}`);

    } catch (error) {
        console.error('Script error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from database');
    }
}

// Run the script
if (require.main === module) {
    fixStudentQRCodes()
        .then(() => {
            console.log('Script completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Script failed:', error);
            process.exit(1);
        });
}

module.exports = fixStudentQRCodes;