const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const doctorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
    },
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: true,
    },
    assignedGroups: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
    }],
    profile: {
        avatar: String,
        phone: String,
        title: {
            type: String,
            enum: ['Dr.', 'Prof.', 'Ass. Prof.', 'Lecturer'],
            default: 'Dr.',
        },
        specialization: String,
        officeHours: String,
    },
    role: {
        type: String,
        default: 'doctor',
        enum: ['doctor'],
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            delete ret.password;
            return ret;
        }
    },
    toObject: { virtuals: true }
});

// Virtual for attendance records they've recorded
doctorSchema.virtual('attendanceRecords', {
    ref: 'Attendance',
    localField: '_id',
    foreignField: 'doctor',
});

// Hash password before saving
doctorSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare password method
doctorSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Doctor', doctorSchema);