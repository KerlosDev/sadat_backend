const mongoose = require('mongoose');
const { connectMongoDB } = require('../config/database');
const { Department, Group, Student, Doctor, Admin } = require('../models');
const QRService = require('../services/qrService');

const seedData = async () => {
    try {
        // Connect to database
        await connectMongoDB();

        console.log('🌱 Starting database seeding...');

        // Clear existing data
        await Promise.all([
            Department.deleteMany({}),
            Group.deleteMany({}),
            Student.deleteMany({}),
            Doctor.deleteMany({}),
            Admin.deleteMany({})
        ]);

        console.log('🧹 Cleared existing data');

        // Create Departments
        const departments = await Department.insertMany([
            {
                name: 'General Department',
                code: 'GEN',
                description: 'General studies and foundational courses'
            },
            {
                name: 'Communication Department',
                code: 'COM',
                description: 'Communication and media studies'
            },
            {
                name: 'Computer Science Department',
                code: 'CS',
                description: 'Computer science and information technology'
            },
            {
                name: 'Engineering Department',
                code: 'ENG',
                description: 'Engineering and technical studies'
            }
        ]);

        console.log('🏢 Created departments');

        // Create Groups
        const groups = [];
        for (let dept of departments) {
            for (let year = 1; year <= 4; year++) {
                for (let groupNum = 1; groupNum <= 3; groupNum++) {
                    groups.push({
                        name: `Group ${groupNum}`,
                        code: `${dept.code}-Y${year}-G${groupNum}`,
                        department: dept._id,
                        year: year,
                        semester: 1,
                        capacity: 30
                    });
                }
            }
        }

        const createdGroups = await Group.insertMany(groups);
        console.log('👥 Created groups');

        // Create Admin
        const admin = new Admin({
            name: 'System Administrator',
            email: 'admin@university.edu',
            password: 'admin123',
            role: 'super_admin',
            permissions: [
                'manage_departments',
                'manage_groups',
                'manage_students',
                'manage_doctors',
                'manage_admins',
                'view_reports',
                'manage_attendance'
            ]
        });

        await admin.save();
        console.log('👑 Created admin user');

        // Create Doctors
        const doctors = [];
        const doctorNames = [
            'Dr. Ahmed Hassan', 'Dr. Fatima Al-Zahra', 'Dr. Mohammed Ali',
            'Dr. Aisha Ibrahim', 'Dr. Omar Khaled', 'Dr. Nour El-Din',
            'Dr. Maryam Youssef', 'Dr. Khaled Mahmoud', 'Dr. Layla Ahmad',
            'Dr. Youssef Mohamed', 'Dr. Zeinab Salah', 'Dr. Hassan Ahmed'
        ];

        for (let i = 0; i < doctorNames.length; i++) {
            const dept = departments[i % departments.length];
            const assignedGroups = createdGroups
                .filter(group => group.department.toString() === dept._id.toString())
                .slice(0, 3)
                .map(group => group._id);

            const doctor = new Doctor({
                name: doctorNames[i],
                email: `doctor${i + 1}@university.edu`,
                password: 'doctor123',
                department: dept._id,
                assignedGroups: assignedGroups,
                profile: {
                    title: i % 4 === 0 ? 'Prof.' : i % 3 === 0 ? 'Ass. Prof.' : 'Dr.',
                    specialization: dept.name.split(' ')[0],
                    phone: `+20100000${1000 + i}`,
                    officeHours: 'Sunday-Thursday: 10:00-12:00'
                }
            });

            await doctor.save();
            doctors.push(doctor);
        }

        console.log('👨‍🏫 Created doctors');

        // Create Students
        const students = [];
        const firstNames = [
            'Ahmed', 'Mohammed', 'Ali', 'Hassan', 'Omar', 'Khaled', 'Youssef', 'Mahmoud',
            'Fatima', 'Aisha', 'Maryam', 'Nour', 'Layla', 'Zeinab', 'Sara', 'Dina'
        ];
        const lastNames = [
            'Hassan', 'Ali', 'Ahmed', 'Mohamed', 'Ibrahim', 'Mahmoud', 'Youssef', 'Khaled',
            'El-Sayed', 'Abdel-Rahman', 'El-Shamy', 'Farouk', 'Mansour', 'El-Khouly'
        ];

        let studentCounter = 1;
        for (let group of createdGroups) {
            // Create 15-25 students per group
            const numStudents = Math.floor(Math.random() * 11) + 15;

            for (let i = 0; i < numStudents; i++) {
                const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
                const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
                const name = `${firstName} ${lastName}`;
                const studentNumber = `STU${String(studentCounter).padStart(6, '0')}`;

                // Generate QR code data immediately
                const qrData = QRService.generateStudentQRData(null, studentNumber);

                // Create student with QR code
                const student = new Student({
                    name: name,
                    email: `student${studentCounter}@university.edu`,
                    password: 'student123',
                    studentNumber: studentNumber,
                    year: group.year,
                    department: group.department,
                    group: group._id,
                    profile: {
                        phone: `+20100${String(studentCounter).padStart(6, '0')}`,
                        dateOfBirth: new Date(2000 + Math.floor(Math.random() * 5), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
                        nationalId: `${29000000000 + studentCounter}`
                    },
                    qrCode: qrData
                });

                await student.save();
                students.push(student);
                studentCounter++;

                // Log progress every 50 students
                if (studentCounter % 50 === 0) {
                    console.log(`📚 Created ${studentCounter} students...`);
                }
            }
        }

        console.log(`🎓 Created ${students.length} students total`);

        // Print summary
        console.log('\n🎉 Database seeding completed successfully!');
        console.log('\n📊 Summary:');
        console.log(`   Departments: ${departments.length}`);
        console.log(`   Groups: ${createdGroups.length}`);
        console.log(`   Doctors: ${doctors.length}`);
        console.log(`   Students: ${students.length}`);
        console.log(`   Admins: 1`);

        console.log('\n🔑 Login Credentials:');
        console.log('   Admin: admin@university.edu / admin123');
        console.log('   Doctor: doctor1@university.edu / doctor123');
        console.log('   Student: student1@university.edu / student123');

        process.exit(0);

    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
};

// Run the seeding
seedData();