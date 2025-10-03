const { Attendance, Student, Doctor, Group, Department } = require('../models');
const mongoose = require('mongoose');

class ReportsController {
    // Get attendance report by student
    static async getStudentAttendanceReport(req, res) {
        try {
            const { studentId, startDate, endDate } = req.query;

            if (!studentId) {
                return res.status(400).json({
                    success: false,
                    message: 'Student ID is required'
                });
            }

            const query = { student: studentId };

            if (startDate || endDate) {
                query.lectureDate = {};
                if (startDate) query.lectureDate.$gte = new Date(startDate);
                if (endDate) query.lectureDate.$lte = new Date(endDate);
            }

            const [student, attendanceRecords, stats] = await Promise.all([
                Student.findById(studentId)
                    .populate('department', 'name code')
                    .populate('group', 'name code')
                    .select('-password -qrCode'),

                Attendance.find(query)
                    .populate('group', 'name code')
                    .populate('doctor', 'name profile.title')
                    .sort({ lectureDate: -1 }),

                Attendance.aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    }
                ])
            ]);

            if (!student) {
                return res.status(404).json({
                    success: false,
                    message: 'Student not found'
                });
            }

            const statsObj = stats.reduce((acc, stat) => {
                acc[stat._id] = stat.count;
                return acc;
            }, {});

            const totalLectures = stats.reduce((sum, stat) => sum + stat.count, 0);
            const presentCount = statsObj.present || 0;
            const attendancePercentage = totalLectures > 0 ? (presentCount / totalLectures) * 100 : 0;

            res.json({
                success: true,
                data: {
                    student,
                    attendanceRecords,
                    statistics: {
                        total: totalLectures,
                        present: presentCount,
                        absent: statsObj.absent || 0,
                        late: statsObj.late || 0,
                        excused: statsObj.excused || 0,
                        attendancePercentage: Math.round(attendancePercentage * 100) / 100
                    }
                }
            });
        } catch (error) {
            console.error('Student attendance report error:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating student attendance report'
            });
        }
    }

    // Get attendance report by group
    static async getGroupAttendanceReport(req, res) {
        try {
            const { groupId, startDate, endDate } = req.query;

            if (!groupId) {
                return res.status(400).json({
                    success: false,
                    message: 'Group ID is required'
                });
            }

            const query = { group: groupId };

            if (startDate || endDate) {
                query.lectureDate = {};
                if (startDate) query.lectureDate.$gte = new Date(startDate);
                if (endDate) query.lectureDate.$lte = new Date(endDate);
            }

            const [group, studentStats, overallStats, dailyStats] = await Promise.all([
                Group.findById(groupId)
                    .populate('department', 'name code')
                    .populate('students', 'name studentNumber'),

                // Student-wise attendance stats
                Attendance.aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: {
                                student: '$student',
                                status: '$status'
                            },
                            count: { $sum: 1 }
                        }
                    },
                    {
                        $group: {
                            _id: '$_id.student',
                            total: { $sum: '$count' },
                            present: {
                                $sum: { $cond: [{ $eq: ['$_id.status', 'present'] }, '$count', 0] }
                            },
                            absent: {
                                $sum: { $cond: [{ $eq: ['$_id.status', 'absent'] }, '$count', 0] }
                            },
                            late: {
                                $sum: { $cond: [{ $eq: ['$_id.status', 'late'] }, '$count', 0] }
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: 'students',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'studentInfo'
                        }
                    },
                    {
                        $addFields: {
                            attendancePercentage: {
                                $multiply: [{ $divide: ['$present', '$total'] }, 100]
                            }
                        }
                    }
                ]),

                // Overall group stats
                Attendance.aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    }
                ]),

                // Daily attendance stats
                Attendance.aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: {
                                date: { $dateToString: { format: '%Y-%m-%d', date: '$lectureDate' } },
                                status: '$status'
                            },
                            count: { $sum: 1 }
                        }
                    },
                    {
                        $group: {
                            _id: '$_id.date',
                            total: { $sum: '$count' },
                            present: {
                                $sum: { $cond: [{ $eq: ['$_id.status', 'present'] }, '$count', 0] }
                            },
                            absent: {
                                $sum: { $cond: [{ $eq: ['$_id.status', 'absent'] }, '$count', 0] }
                            }
                        }
                    },
                    { $sort: { _id: 1 } }
                ])
            ]);

            if (!group) {
                return res.status(404).json({
                    success: false,
                    message: 'Group not found'
                });
            }

            const overallStatsObj = overallStats.reduce((acc, stat) => {
                acc[stat._id] = stat.count;
                return acc;
            }, {});

            const totalRecords = overallStats.reduce((sum, stat) => sum + stat.count, 0);
            const presentCount = overallStatsObj.present || 0;
            const groupAttendancePercentage = totalRecords > 0 ? (presentCount / totalRecords) * 100 : 0;

            res.json({
                success: true,
                data: {
                    group,
                    studentStats,
                    overallStats: {
                        ...overallStatsObj,
                        total: totalRecords,
                        attendancePercentage: Math.round(groupAttendancePercentage * 100) / 100
                    },
                    dailyStats
                }
            });
        } catch (error) {
            console.error('Group attendance report error:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating group attendance report'
            });
        }
    }

    // Get attendance report by doctor
    static async getDoctorAttendanceReport(req, res) {
        try {
            const { doctorId, startDate, endDate } = req.query;
            const targetDoctorId = doctorId || req.user.id;

            const query = { doctor: targetDoctorId };

            if (startDate || endDate) {
                query.lectureDate = {};
                if (startDate) query.lectureDate.$gte = new Date(startDate);
                if (endDate) query.lectureDate.$lte = new Date(endDate);
            }

            const [doctor, groupStats, overallStats, monthlyStats] = await Promise.all([
                Doctor.findById(targetDoctorId)
                    .populate('department', 'name code')
                    .populate('assignedGroups', 'name code')
                    .select('-password'),

                // Group-wise stats
                Attendance.aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: {
                                group: '$group',
                                status: '$status'
                            },
                            count: { $sum: 1 }
                        }
                    },
                    {
                        $group: {
                            _id: '$_id.group',
                            total: { $sum: '$count' },
                            present: {
                                $sum: { $cond: [{ $eq: ['$_id.status', 'present'] }, '$count', 0] }
                            },
                            absent: {
                                $sum: { $cond: [{ $eq: ['$_id.status', 'absent'] }, '$count', 0] }
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: 'groups',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'groupInfo'
                        }
                    },
                    {
                        $addFields: {
                            attendancePercentage: {
                                $multiply: [{ $divide: ['$present', '$total'] }, 100]
                            }
                        }
                    }
                ]),

                // Overall stats
                Attendance.aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    }
                ]),

                // Monthly stats
                Attendance.aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: {
                                month: { $dateToString: { format: '%Y-%m', date: '$lectureDate' } },
                                status: '$status'
                            },
                            count: { $sum: 1 }
                        }
                    },
                    {
                        $group: {
                            _id: '$_id.month',
                            total: { $sum: '$count' },
                            present: {
                                $sum: { $cond: [{ $eq: ['$_id.status', 'present'] }, '$count', 0] }
                            }
                        }
                    },
                    { $sort: { _id: 1 } }
                ])
            ]);

            if (!doctor) {
                return res.status(404).json({
                    success: false,
                    message: 'Doctor not found'
                });
            }

            const overallStatsObj = overallStats.reduce((acc, stat) => {
                acc[stat._id] = stat.count;
                return acc;
            }, {});

            const totalRecords = overallStats.reduce((sum, stat) => sum + stat.count, 0);

            res.json({
                success: true,
                data: {
                    doctor,
                    groupStats,
                    overallStats: {
                        ...overallStatsObj,
                        total: totalRecords
                    },
                    monthlyStats
                }
            });
        } catch (error) {
            console.error('Doctor attendance report error:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating doctor attendance report'
            });
        }
    }

    // Get department attendance report
    static async getDepartmentAttendanceReport(req, res) {
        try {
            const { departmentId, startDate, endDate } = req.query;

            if (!departmentId) {
                return res.status(400).json({
                    success: false,
                    message: 'Department ID is required'
                });
            }

            // Get all groups in the department
            const groups = await Group.find({ department: departmentId });
            const groupIds = groups.map(group => group._id);

            const query = { group: { $in: groupIds } };

            if (startDate || endDate) {
                query.lectureDate = {};
                if (startDate) query.lectureDate.$gte = new Date(startDate);
                if (endDate) query.lectureDate.$lte = new Date(endDate);
            }

            const [department, groupStats, yearStats, overallStats] = await Promise.all([
                Department.findById(departmentId),

                // Group-wise stats
                Attendance.aggregate([
                    { $match: query },
                    {
                        $lookup: {
                            from: 'groups',
                            localField: 'group',
                            foreignField: '_id',
                            as: 'groupInfo'
                        }
                    },
                    {
                        $group: {
                            _id: {
                                group: '$group',
                                status: '$status'
                            },
                            count: { $sum: 1 },
                            groupInfo: { $first: '$groupInfo' }
                        }
                    },
                    {
                        $group: {
                            _id: '$_id.group',
                            total: { $sum: '$count' },
                            present: {
                                $sum: { $cond: [{ $eq: ['$_id.status', 'present'] }, '$count', 0] }
                            },
                            groupInfo: { $first: '$groupInfo' }
                        }
                    },
                    {
                        $addFields: {
                            attendancePercentage: {
                                $multiply: [{ $divide: ['$present', '$total'] }, 100]
                            }
                        }
                    }
                ]),

                // Year-wise stats
                Attendance.aggregate([
                    { $match: query },
                    {
                        $lookup: {
                            from: 'groups',
                            localField: 'group',
                            foreignField: '_id',
                            as: 'groupInfo'
                        }
                    },
                    {
                        $group: {
                            _id: {
                                year: { $arrayElemAt: ['$groupInfo.year', 0] },
                                status: '$status'
                            },
                            count: { $sum: 1 }
                        }
                    },
                    {
                        $group: {
                            _id: '$_id.year',
                            total: { $sum: '$count' },
                            present: {
                                $sum: { $cond: [{ $eq: ['$_id.status', 'present'] }, '$count', 0] }
                            }
                        }
                    },
                    {
                        $addFields: {
                            attendancePercentage: {
                                $multiply: [{ $divide: ['$present', '$total'] }, 100]
                            }
                        }
                    },
                    { $sort: { _id: 1 } }
                ]),

                // Overall stats
                Attendance.aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    }
                ])
            ]);

            if (!department) {
                return res.status(404).json({
                    success: false,
                    message: 'Department not found'
                });
            }

            const overallStatsObj = overallStats.reduce((acc, stat) => {
                acc[stat._id] = stat.count;
                return acc;
            }, {});

            const totalRecords = overallStats.reduce((sum, stat) => sum + stat.count, 0);
            const presentCount = overallStatsObj.present || 0;
            const departmentAttendancePercentage = totalRecords > 0 ? (presentCount / totalRecords) * 100 : 0;

            res.json({
                success: true,
                data: {
                    department,
                    groupStats,
                    yearStats,
                    overallStats: {
                        ...overallStatsObj,
                        total: totalRecords,
                        attendancePercentage: Math.round(departmentAttendancePercentage * 100) / 100
                    }
                }
            });
        } catch (error) {
            console.error('Department attendance report error:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating department attendance report'
            });
        }
    }

    // Get system overview stats
    static async getSystemOverview(req, res) {
        try {
            const [
                totalStudents,
                totalDoctors,
                totalGroups,
                totalDepartments,
                todayAttendance,
                weeklyAttendance,
                topPerformingGroups,
                recentActivity
            ] = await Promise.all([
                Student.countDocuments({ isActive: true }),
                Doctor.countDocuments({ isActive: true }),
                Group.countDocuments(),
                Department.countDocuments(),

                // Today's attendance
                Attendance.aggregate([
                    {
                        $match: {
                            lectureDate: {
                                $gte: new Date().setHours(0, 0, 0, 0),
                                $lt: new Date().setHours(23, 59, 59, 999)
                            }
                        }
                    },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    }
                ]),

                // Weekly attendance
                Attendance.aggregate([
                    {
                        $match: {
                            lectureDate: {
                                $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                            }
                        }
                    },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    }
                ]),

                // Top performing groups
                Attendance.aggregate([
                    {
                        $group: {
                            _id: '$group',
                            total: { $sum: 1 },
                            present: {
                                $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
                            }
                        }
                    },
                    {
                        $addFields: {
                            attendancePercentage: {
                                $multiply: [{ $divide: ['$present', '$total'] }, 100]
                            }
                        }
                    },
                    {
                        $lookup: {
                            from: 'groups',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'groupInfo'
                        }
                    },
                    { $sort: { attendancePercentage: -1 } },
                    { $limit: 5 }
                ]),

                // Recent activity
                Attendance.find()
                    .populate('student', 'name studentNumber')
                    .populate('group', 'name')
                    .populate('doctor', 'name')
                    .sort({ createdAt: -1 })
                    .limit(10)
            ]);

            const todayStats = todayAttendance.reduce((acc, stat) => {
                acc[stat._id] = stat.count;
                return acc;
            }, {});

            const weeklyStats = weeklyAttendance.reduce((acc, stat) => {
                acc[stat._id] = stat.count;
                return acc;
            }, {});

            res.json({
                success: true,
                data: {
                    overview: {
                        totalStudents,
                        totalDoctors,
                        totalGroups,
                        totalDepartments
                    },
                    todayAttendance: todayStats,
                    weeklyAttendance: weeklyStats,
                    topPerformingGroups,
                    recentActivity
                }
            });
        } catch (error) {
            console.error('System overview error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching system overview'
            });
        }
    }
}

module.exports = ReportsController;