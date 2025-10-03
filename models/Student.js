const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema({
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
    studentNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    year: {
        type: Number,
        required: true,
        min: 1,
        max: 6,
    },
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: true,
    },
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true,
    },
    profile: {
        avatar: String,
        phone: String,
        address: String,
        dateOfBirth: Date,
        nationalId: String,
    },
    qrCode: {
        type: String,
        unique: true,
        required: true,
    },
    role: {
        type: String,
        default: 'student',
        enum: ['student'],
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

// Virtual for attendance records
studentSchema.virtual('attendanceRecords', {
    ref: 'Attendance',
    localField: '_id',
    foreignField: 'student',
});

// Hash password before saving
studentSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare password method
studentSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Student', studentSchema);