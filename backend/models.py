from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'admin', 'company', 'student'
    is_active = db.Column(db.Integer, default=1)
    my_applications = db.relationship('Application', backref='student_user', lazy=True)

    def set_password(self, password):
        self.password = generate_password_hash(password)

    def check_password(self, password):
        if not self.password:
            return False
        if self.password == password:
            return True
        try:
            return check_password_hash(self.password, password)
        except Exception:
            return False

class Drive(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    company_name = db.Column(db.String(100), nullable=False)
    job_title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    skills_required = db.Column(db.String(200))
    salary_range = db.Column(db.String(100))
    eligibility_criteria = db.Column(db.String(200))
    application_deadline = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), default='Pending')  # Admin status: 'Pending', 'Approved', 'Rejected'
    drive_status = db.Column(db.String(20), default='Active')  # Company status: 'Active', 'Closed'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    company_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

class CompanyProfile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True)
    company_name_full = db.Column(db.String(200))
    industry = db.Column(db.String(100))
    location = db.Column(db.String(100))
    website = db.Column(db.String(200))
    address = db.Column(db.Text)
    contact_person = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    approval_status = db.Column(db.String(20), default='Pending')

class StudentProfile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), unique=True)
    profile_pic = db.Column(db.String(150), default='default.jpg')
    full_name = db.Column(db.String(100), nullable=False)
    student_id = db.Column(db.String(50), unique=True)
    branch = db.Column(db.String(50))
    year = db.Column(db.Integer)
    cgpa = db.Column(db.Float)
    skills = db.Column(db.Text)
    resume_link = db.Column(db.String(500))
    placement_status = db.Column(db.String(50), default='Opt-in')
    user = db.relationship('User', backref=db.backref('profile', uselist=False))

class Application(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    drive_id = db.Column(db.Integer, db.ForeignKey('drive.id'), nullable=False)
    applied_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='Applied')  # 'Applied', 'Shortlisted', 'Selected', 'Rejected'
    feedback = db.Column(db.Text, nullable=True)
    interview_date = db.Column(db.DateTime, nullable=True)
    drive = db.relationship('Drive', backref='applications')

class Placement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    company_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    drive_id = db.Column(db.Integer, db.ForeignKey('drive.id'), nullable=False)
    position = db.Column(db.String(100), nullable=False)
    salary = db.Column(db.String(100))
    joining_date = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(50), default='Confirmed')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    student = db.relationship('User', foreign_keys=[student_id], backref='placements')
    company = db.relationship('User', foreign_keys=[company_id])
    drive = db.relationship('Drive', foreign_keys=[drive_id])