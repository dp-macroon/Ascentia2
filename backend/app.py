import os
import sys

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
from models import db, User, Drive, CompanyProfile, StudentProfile, Application, Placement
import jwt
from datetime import datetime, timedelta
import json
import redis
from functools import wraps
from werkzeug.utils import secure_filename

# Redis Cache Client Setup 
try:
    redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True, protocol=2, socket_connect_timeout=2)
except Exception:
    redis_client = None

def cache_get(key):
    if not redis_client:
        return None
    try:
        val = redis_client.get(key)
        return json.loads(val) if val else None
    except Exception:
        return None

def cache_set(key, value, timeout=300):
    if not redis_client:
        return
    try:
        redis_client.set(key, json.dumps(value), ex=timeout)
    except Exception:
        pass


def cache_clear_pattern(pattern):
    if not redis_client:
        return
    try:
        keys = redis_client.keys(f"{pattern}*")
        if keys:
            redis_client.delete(*keys)
    except Exception:
        pass

def calculate_progress(profile):

    fields = [profile.full_name, profile.cgpa, profile.skills, profile.resume_link]
    filled = sum(1 for f in fields if f is not None and str(f).strip() != '')
    return int((filled / len(fields)) * 100)

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"
INSTANCE_DIR = BACKEND_DIR / "instance"
INSTANCE_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = INSTANCE_DIR / "placement_portal.db"

app = Flask(
    __name__,
    template_folder=str(FRONTEND_DIR / "templates"),
    static_folder=str(FRONTEND_DIR / "static"),
    static_url_path="/static"
)
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{DB_PATH.as_posix()}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'your_secret_key_here'
app.config['JWT_SECRET_KEY'] = 'placement_portal_jwt_secret_key_2026'

db.init_app(app)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header:
            parts = auth_header.split()
            if len(parts) == 2 and parts[0].lower() == 'bearer':
                token = parts[1]
        
        if not token:
            return jsonify({'error': 'Token is missing!'}), 401
        
        try:
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=["HS256"])
            current_user = User.query.get(int(data['sub']))
            if not current_user:
                return jsonify({'error': 'User not found!'}), 401
            if current_user.is_active == 0:
                return jsonify({'error': 'Account is deactivated/blacklisted!'}), 403
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token!'}), 401

        return f(current_user, *args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    @token_required
    def decorated(current_user, *args, **kwargs):
        if current_user.role != 'admin':
            return jsonify({'error': 'Admin privileges required!'}), 403
        return f(current_user, *args, **kwargs)
    return decorated

def company_required(f):
    @wraps(f)
    @token_required
    def decorated(current_user, *args, **kwargs):
        if current_user.role != 'company':
            return jsonify({'error': 'Company privileges required!'}), 403
        company_profile = CompanyProfile.query.filter_by(user_id=current_user.id).first()
        if not company_profile or company_profile.approval_status != 'Approved':
            return jsonify({'error': 'Your company profile is pending Admin approval.'}), 403
        return f(current_user, company_profile, *args, **kwargs)
    return decorated

def student_required(f):
    @wraps(f)
    @token_required
    def decorated(current_user, *args, **kwargs):
        if current_user.role != 'student':
            return jsonify({'error': 'Student access required!'}), 403
        student_profile = StudentProfile.query.filter_by(user_id=current_user.id).first()
        if not student_profile:
            student_profile = StudentProfile(user_id=current_user.id, full_name=current_user.email.split('@')[0])
            db.session.add(student_profile)
            db.session.commit()
        return f(current_user, student_profile, *args, **kwargs)
    return decorated


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        # Query the User table
        user = User.query.filter_by(email=email).first()
        
        # 1. Check if user exists and password matches
        if user and user.check_password(password): 
            
            # 2. Check if account is blacklisted
            if user.is_active == 0:
                flash("Your account has been deactivated/blacklisted by Admin.")
                return redirect(url_for('login'))
            
            # 3. Role-specific logic for Companies (Check Approval)
            if user.role == 'company':
                profile = CompanyProfile.query.filter_by(user_id=user.id).first()
                if profile and profile.approval_status != 'Approved':
                    flash("Your company profile is pending Admin approval.")
                    return redirect(url_for('login'))
            
            # 4. If all checks pass, start session
            session['user_id'] = user.id
            session['role'] = user.role
            
            # Redirect to respective dashboard
            if user.role == 'admin':
                return redirect(url_for('admin_dashboard'))
            elif user.role == 'company':
                return redirect(url_for('company_dashboard'))
            else:
                return redirect(url_for('student_dashboard'))
        
        flash("Invalid email or password.")
    return render_template('login.html')

@app.route('/admin/dashboard')
def admin_dashboard():
    if session.get('role') != 'admin':
        return redirect(url_for('login'))
        
    pending_drives = Drive.query.filter_by(status='Pending').all()
    
    # Stats for the top cards
    stats = {
        'students': User.query.filter_by(role='student').count(),
        'companies': User.query.filter_by(role='company').count(),
        'drives': Drive.query.count(),
        'applications': Application.query.count() 
    }
    total_opt_in = StudentProfile.query.filter_by(placement_status='Opt-in').count()
    total_placed = db.session.query(Application.student_id).filter_by(status='Selected').distinct().count()
    placement_ratio = (total_placed / total_opt_in * 100) if total_opt_in > 0 else 0

    return render_template('admin_dash.html', 
                           placement_ratio=placement_ratio,
                           drives=pending_drives, 
                           stats=stats,
                           pending_companies=CompanyProfile.query.filter_by(approval_status='Pending').all(),
                           all_users=User.query.filter(User.role != 'admin').all())

@app.route('/admin/approve_company/<int:profile_id>', methods=['POST'])
def approve_company(profile_id):
    if session.get('role') == 'admin':
        profile = CompanyProfile.query.get(profile_id)
        if profile:
            profile.approval_status = 'Approved'
            db.session.commit()
            flash("Company Approved!")
    return redirect(url_for('admin_dashboard'))

@app.route('/admin/toggle_status/<int:user_id>', methods=['POST'])
def toggle_status(user_id):
    if session.get('role') == 'admin':
        user = User.query.get(user_id)
        if user:
            user.is_active = 0 if user.is_active == 1 else 1
            db.session.commit()
            flash("User status updated.")
    return redirect(url_for('admin_dashboard'))

@app.route('/admin/approve_drive/<int:drive_id>', methods=['POST'])
def approve_drive(drive_id):
    if session.get('role') == 'admin':
        drive = Drive.query.get(drive_id)
        if drive:
            drive.status = 'Approved'
            db.session.commit()
            flash(f"Drive for {drive.company_name} Approved!")
    return redirect(url_for('admin_dashboard'))

@app.route('/admin/search')
def admin_search():
    if session.get('role') != 'admin':
        return redirect(url_for('login'))
        
    query = request.args.get('query', '')
    results = User.query.outerjoin(StudentProfile).filter(
        (User.email.contains(query)) | 
        (StudentProfile.full_name.contains(query))
    ).all()

    stats = {
        'students': User.query.filter_by(role='student').count(), 
        'companies': User.query.filter_by(role='company').count(),
        'drives': Drive.query.count(), 
        'applications': Application.query.count()
    }
    
    pending_drives = Drive.query.filter_by(status='Pending').all()
    pending_cos = CompanyProfile.query.filter_by(approval_status='Pending').all()
    
    return render_template('admin_dash.html', 
                           all_users=results, 
                           stats=stats, 
                           pending_companies=pending_cos, 
                           drives=pending_drives)

@app.route('/api/student/applications/<int:user_id>', methods=['GET'])
def api_get_applications(user_id):
    if session.get('user_id') != user_id and session.get('role') != 'admin':
        return jsonify({"error": "Unauthorized"}), 403

    apps = Application.query.filter_by(student_id=user_id).all()
    results = []
    for a in apps:
        results.append({
            "drive_id": a.drive_id,
            "company": a.drive.company_name,
            "role": a.drive.job_title,
            "status": a.status,
            "applied_on": a.applied_at.strftime('%Y-%m-%d')
        })
    
    return jsonify({
        "student_id": user_id,
        "total_applications": len(results),
        "history": results
    }), 200

#API 4 Methods
@app.route('/api/drive/<int:drive_id>', methods=['GET', 'POST', 'PUT', 'DELETE'])
def manage_drive_api(drive_id):
    # GET: Fetch drive details
    if request.method == 'GET':
        drive = Drive.query.get_or_404(drive_id)
        return jsonify({"title": drive.job_title, "company": drive.company_name})

    # POST: Duplicate a drive for a new season
    if request.method == 'POST':
        # Logic to copy drive data
        return jsonify({"message": "Drive duplicated successfully"}), 201

    # PUT: Update drive requirements
    if request.method == 'PUT':
        drive = Drive.query.get(drive_id)
        data = request.get_json()
        drive.skills_required = data.get('skills', drive.skills_required)
        db.session.commit()
        return jsonify({"message": "Drive updated"})

    # DELETE: Archive/Remove a drive (Admin only)
    if request.method == 'DELETE':
        drive = Drive.query.get(drive_id)
        db.session.delete(drive)
        db.session.commit()
        return jsonify({"message": "Drive deleted"})
    
@app.route('/company/create_drive', methods=['GET', 'POST'])
def create_drive():
    if session.get('role') != 'company':
        return redirect(url_for('login'))
        
    if request.method == 'POST':
        new_drive = Drive(
            company_name=request.form.get('company_name'), 
            job_title=request.form.get('job_title'),
            skills_required=request.form.get('skills_required'),
            salary_range=request.form.get('salary_range'),       
            description=request.form.get('description'),
            company_id=session['user_id'],
            status='Pending'
        )
        db.session.add(new_drive)
        db.session.commit()
        flash("Drive created successfully!")
        return redirect(url_for('company_dashboard'))
    return render_template('create_drive.html')

@app.route('/company/dashboard')
def company_dashboard():
    if session.get('role') != 'company':
        return redirect(url_for('login'))
    
    profile = CompanyProfile.query.filter_by(user_id=session['user_id']).first()
    my_drives = Drive.query.filter_by(company_id=session['user_id']).all()
    
    return render_template('company_dash.html', profile=profile, drives=my_drives)

@app.route('/company/view_applicants/<int:drive_id>')
def view_applicants(drive_id):
    if session.get('role') != 'company':
        return redirect(url_for('login'))
    
    drive = Drive.query.get_or_404(drive_id)
    applicants = db.session.query(Application, StudentProfile).join(
        StudentProfile, Application.student_id == StudentProfile.user_id
    ).filter(Application.drive_id == drive_id).all()
    
    return render_template('view_applicants.html', drive=drive, applicants=applicants)

@app.route('/company/update_drive_status/<int:drive_id>', methods=['POST'])
def update_drive_status(drive_id):
    drive = Drive.query.get(drive_id)
    if drive:
        drive.drive_status = request.form.get('drive_status')
        db.session.commit()
        flash("Drive status updated!")
    return redirect(url_for('company_dashboard'))

@app.route('/company/update_app_status/<int:app_id>', methods=['POST'])
def update_app_status(app_id):
    application = Application.query.get(app_id)
    if application:
        application.status = request.form.get('new_status')
        db.session.commit()
        flash("Student status updated!")
    return redirect(url_for('view_applicants', drive_id=application.drive_id))

@app.route('/student/dashboard')
def student_dashboard():
    if session.get('role') != 'student':
        return redirect(url_for('login'))
        
    approved_drives = Drive.query.filter_by(status='Approved').all()
    profile = StudentProfile.query.filter_by(user_id=session['user_id']).first()
    
    # Calculate progress
    progress = calculate_progress(profile) if profile else 0
    
    return render_template('student_dash.html', 
                           drives=approved_drives, 
                           profile=profile, 
                           progress=progress)

@app.route('/student/update_profile', methods=['POST'])
def update_student_profile():
    if session.get('role') != 'student':
        return redirect(url_for('login'))
    # Get the existing profile for the logged-in user
    profile = StudentProfile.query.filter_by(user_id=session['user_id']).first()
    
    if profile:
        profile.cgpa = request.form.get('cgpa')
        profile.resume_link = request.form.get('resume')
        profile.placement_status = request.form.get('status')
        profile.skills = request.form.get('skills')
        db.session.commit()
        flash("Profile updated successfully!", "success")
    else:
        flash("Profile not found.", "danger")
        
    return redirect(url_for('student_dashboard'))

@app.route('/student/upload_photo', methods=['POST'])
def upload_photo():
    profile = StudentProfile.query.filter_by(user_id=session.get('user_id')).first()
    file = request.files['profile_pic']
    
    if file and file.filename != '':
        filename = secure_filename(file.filename)
        upload_folder = os.path.join('static', 'uploads')
        
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder)
            
        file.save(os.path.join(upload_folder, filename))
        
        # UPDATE DATABASE
        profile.profile_pic = filename
        db.session.commit()
        
    return redirect('/student/dashboard')

@app.route('/student/apply/<int:drive_id>', methods=['POST'])
def apply_now(drive_id):
    if session.get('role') != 'student':
        return redirect(url_for('login'))
    existing_app = Application.query.filter_by(
        student_id=session['user_id'], 
        drive_id=drive_id
    ).first()
    
    if existing_app:
        flash("You have already applied for this position!", "warning")
    else:
        new_app = Application(
            student_id=session['user_id'],
            drive_id=drive_id,
            status='Applied'
        )
        db.session.add(new_app)
        db.session.commit()
        flash("Application submitted successfully!", "success")
        
    return redirect(url_for('student_dashboard'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        role = request.form.get('role')
        
        # 1. Check if email already exists
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            flash("Email already registered. Please login or use a different email.", "danger")
            return redirect(url_for('register'))
        # 2. If it's a new email, proceed to create the user
        new_user = User(email=email, role=role)
        new_user.set_password(password)
        db.session.add(new_user)
        
        try:
            db.session.flush() 
            if role == 'company':
                new_profile = CompanyProfile(
                    user_id=new_user.id,
                    company_name_full=request.form.get('full_name'),
                    approval_status='Pending'
                )
                db.session.add(new_profile)
            elif role == 'student':
                new_profile = StudentProfile(
                    user_id=new_user.id,
                    full_name=request.form.get('full_name')
                )
                db.session.add(new_profile)

            db.session.commit()
            flash("Registration successful! Please login.", "success")
            return redirect(url_for('login'))
            
        except Exception as e:
            db.session.rollback()
            flash("Database error occurred. Please try again.", "danger")
            return redirect(url_for('register'))
            
    return render_template('register.html')

@app.route('/logout')
def logout():
    session.clear()
    flash("You have been logged out.")
    return redirect(url_for('login'))

# REST API ENDPOINTS 
@app.route('/api/auth/login', methods=['POST'])
def api_login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Email and password are required.'}), 400

    user = User.query.filter_by(email=email).first()

    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid email or password.'}), 401

    if user.is_active == 0:
        return jsonify({'error': 'Your account has been deactivated/blacklisted by Admin.'}), 403

    if user.role == 'company':
        profile = CompanyProfile.query.filter_by(user_id=user.id).first()
        if not profile or profile.approval_status != 'Approved':
            return jsonify({'error': 'Your company profile is pending Admin approval.'}), 403

    token_payload = {
        'sub': str(user.id),
        'email': user.email,
        'role': user.role,
        'exp': datetime.utcnow() + timedelta(hours=24)
    }

    token = jwt.encode(token_payload, app.config['JWT_SECRET_KEY'], algorithm='HS256')

    return jsonify({
        'token': token,
        'user': {
            'id': user.id,
            'email': user.email,
            'role': user.role
        }
    }), 200

@app.route('/api/auth/register', methods=['POST'])
def api_register():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')
    role = data.get('role')
    full_name = data.get('full_name', '')

    if not email or not password or not role:
        return jsonify({'error': 'Email, password, and role are required.'}), 400

    if role == 'admin':
        return jsonify({'error': 'Admin registration is not allowed.'}), 403

    if role not in ['student', 'company']:
        return jsonify({'error': 'Invalid user role specified.'}), 400

    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        return jsonify({'error': 'Email already registered. Please login.'}), 409

    new_user = User(email=email, role=role)
    new_user.set_password(password)
    db.session.add(new_user)

    try:
        db.session.flush()
        if role == 'company':
            new_profile = CompanyProfile(
                user_id=new_user.id,
                company_name_full=full_name,
                approval_status='Pending'
            )
            db.session.add(new_profile)
        elif role == 'student':
            new_profile = StudentProfile(
                user_id=new_user.id,
                full_name=full_name
            )
            db.session.add(new_profile)

        db.session.commit()
        cache_clear_pattern('admin_companies')
        cache_clear_pattern('admin_users')
        cache_clear_pattern('admin_stats')
        cache_clear_pattern('public_stats')
        return jsonify({'message': 'Registration successful! Please login.'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Database error during registration.'}), 500


@app.route('/api/auth/me', methods=['GET'])
@token_required
def api_auth_me(current_user):
    profile_data = {}
    if current_user.role == 'student' and current_user.profile:
        profile_data = {
            'full_name': current_user.profile.full_name,
            'student_id': current_user.profile.student_id,
            'branch': current_user.profile.branch,
            'year': current_user.profile.year,
            'cgpa': current_user.profile.cgpa,
            'skills': current_user.profile.skills,
            'resume_link': current_user.profile.resume_link,
            'profile_pic': current_user.profile.profile_pic,
            'placement_status': current_user.profile.placement_status
        }
    elif current_user.role == 'company':
        comp = CompanyProfile.query.filter_by(user_id=current_user.id).first()
        if comp:
            profile_data = {
                'company_name': comp.company_name_full,
                'approval_status': comp.approval_status,
                'industry': comp.industry,
                'website': comp.website
            }

    return jsonify({
        'user': {
            'id': current_user.id,
            'email': current_user.email,
            'role': current_user.role,
            'is_active': current_user.is_active
        },
        'profile': profile_data
    }), 200

@app.route('/api/admin/stats', methods=['GET'])
@admin_required
def api_admin_stats(current_user):
    cached_stats = cache_get('admin_stats')
    if cached_stats:
        return jsonify(cached_stats), 200

    total_students = User.query.filter_by(role='student').count()
    total_companies = User.query.filter_by(role='company').count()
    total_drives = Drive.query.count()
    total_applications = Application.query.count()

    opt_in_students = StudentProfile.query.filter_by(placement_status='Opt-in').count()
    placed_students = db.session.query(Application.student_id).filter_by(status='Selected').distinct().count()
    placement_ratio = round((placed_students / opt_in_students * 100), 1) if opt_in_students > 0 else 0.0

    pending_companies_count = CompanyProfile.query.filter_by(approval_status='Pending').count()
    pending_drives_count = Drive.query.filter_by(status='Pending').count()

    stats_payload = {
        'students': total_students,
        'companies': total_companies,
        'drives': total_drives,
        'applications': total_applications,
        'opt_in_students': opt_in_students,
        'placed_students': placed_students,
        'placement_ratio': placement_ratio,
        'pending_companies_count': pending_companies_count,
        'pending_drives_count': pending_drives_count
    }
    cache_set('admin_stats', stats_payload, timeout=300)
    return jsonify(stats_payload), 200


@app.route('/api/admin/companies', methods=['GET'])
@admin_required
def api_admin_companies(current_user):
    cache_key = "admin_companies_all"
    cached = cache_get(cache_key)
    if cached is not None:
        return jsonify(cached), 200

    companies = CompanyProfile.query.all()
    results = []
    for c in companies:
        user = User.query.get(c.user_id)
        results.append({
            'profile_id': c.id,
            'user_id': c.user_id,
            'email': user.email if user else '',
            'company_name': c.company_name_full,
            'industry': c.industry,
            'location': c.location,
            'website': c.website,
            'contact_person': c.contact_person,
            'phone': c.phone,
            'approval_status': c.approval_status,
            'is_active': user.is_active if user else 1
        })
    cache_set(cache_key, results, timeout=300)
    return jsonify(results), 200

@app.route('/api/admin/companies/<int:profile_id>/approve', methods=['POST'])
@admin_required
def api_admin_approve_company(current_user, profile_id):
    profile = CompanyProfile.query.get_or_404(profile_id)
    profile.approval_status = 'Approved'
    db.session.commit()
    cache_clear_pattern('admin_stats')
    cache_clear_pattern('admin_companies')
    return jsonify({'message': f'Company "{profile.company_name_full}" approved successfully.'}), 200

@app.route('/api/admin/companies/<int:profile_id>/reject', methods=['POST'])
@admin_required
def api_admin_reject_company(current_user, profile_id):
    profile = CompanyProfile.query.get_or_404(profile_id)
    profile.approval_status = 'Rejected'
    db.session.commit()
    cache_clear_pattern('admin_stats')
    cache_clear_pattern('admin_companies')
    return jsonify({'message': f'Company "{profile.company_name_full}" rejected.'}), 200


@app.route('/api/admin/drives', methods=['GET'])
@admin_required
def api_admin_drives(current_user):
    drives = Drive.query.order_by(Drive.created_at.desc()).all()
    results = []
    for d in drives:
        results.append({
            'id': d.id,
            'company_name': d.company_name,
            'job_title': d.job_title,
            'description': d.description,
            'skills_required': d.skills_required,
            'salary_range': d.salary_range,
            'eligibility_criteria': d.eligibility_criteria,
            'application_deadline': d.application_deadline.strftime('%Y-%m-%d') if d.application_deadline else None,
            'status': d.status,
            'drive_status': d.drive_status,
            'created_at': d.created_at.strftime('%Y-%m-%d'),
            'company_id': d.company_id,
            'applicant_count': Application.query.filter_by(drive_id=d.id).count()
        })
    return jsonify(results), 200

@app.route('/api/admin/drives/<int:drive_id>/approve', methods=['POST'])
@admin_required
def api_admin_approve_drive(current_user, drive_id):
    drive = Drive.query.get_or_404(drive_id)
    drive.status = 'Approved'
    db.session.commit()
    cache_clear_pattern('admin_stats')
    cache_clear_pattern('drives_')
    return jsonify({'message': f'Placement drive for "{drive.job_title}" approved.'}), 200

@app.route('/api/admin/drives/<int:drive_id>/reject', methods=['POST'])
@admin_required
def api_admin_reject_drive(current_user, drive_id):
    drive = Drive.query.get_or_404(drive_id)
    drive.status = 'Rejected'
    db.session.commit()
    cache_clear_pattern('admin_stats')
    cache_clear_pattern('drives_')
    return jsonify({'message': f'Placement drive for "{drive.job_title}" rejected.'}), 200

@app.route('/api/admin/drives/<int:drive_id>', methods=['DELETE'])
@admin_required
def api_admin_delete_drive(current_user, drive_id):
    drive = Drive.query.get_or_404(drive_id)
    Application.query.filter_by(drive_id=drive_id).delete()
    db.session.delete(drive)
    db.session.commit()
    cache_clear_pattern('admin_stats')
    cache_clear_pattern('drives_')
    return jsonify({'message': 'Placement drive deleted successfully.'}), 200

@app.route('/api/public/stats', methods=['GET'])
def api_public_stats():
    cached = cache_get('public_stats')
    if cached is not None:
        return jsonify(cached), 200

    total_students = User.query.filter_by(role='student').count()
    total_companies = CompanyProfile.query.filter_by(approval_status='Approved').count()
    total_drives = Drive.query.filter_by(status='Approved').count()
    total_placements = Application.query.filter_by(status='Selected').count()

    skills_map = {}
    drives = Drive.query.filter_by(status='Approved', drive_status='Active').all()
    for d in drives:
        if d.skills_required:
            skills = [s.strip().title() for s in d.skills_required.replace(',', ';').split(';') if s.strip()]
            for s in skills:
                skills_map[s] = skills_map.get(s, 0) + 1

    top_skills = sorted([{'skill': k, 'count': v} for k, v in skills_map.items()], key=lambda x: x['count'], reverse=True)[:6]

    payload = {
        'total_students': total_students,
        'total_companies': total_companies,
        'total_drives': total_drives,
        'total_placements': total_placements,
        'top_skills': top_skills
    }
    cache_set('public_stats', payload, timeout=300)
    return jsonify(payload), 200

@app.route('/api/admin/users', methods=['GET'])
@admin_required
def api_admin_users(current_user):
    query_str = request.args.get('query', '').strip()
    cache_key = f"admin_users_{query_str}"
    cached = cache_get(cache_key)
    if cached is not None:
        return jsonify(cached), 200

    users_query = User.query.filter(User.role != 'admin')

    if query_str:
        users_query = users_query.outerjoin(StudentProfile).outerjoin(CompanyProfile).filter(
            (User.email.contains(query_str)) |
            (StudentProfile.full_name.contains(query_str)) |
            (StudentProfile.student_id.contains(query_str)) |
            (CompanyProfile.company_name_full.contains(query_str))
        )

    users = users_query.all()
    results = []
    for u in users:
        name = ''
        details = ''
        if u.role == 'student' and u.profile:
            name = u.profile.full_name
            details = f"ID: {u.profile.student_id or 'N/A'} | Branch: {u.profile.branch or 'N/A'} | CGPA: {u.profile.cgpa or 'N/A'}"
        elif u.role == 'company':
            cp = CompanyProfile.query.filter_by(user_id=u.id).first()
            if cp:
                name = cp.company_name_full
                details = f"Status: {cp.approval_status} | Contact: {cp.contact_person or 'N/A'}"

        results.append({
            'user_id': u.id,
            'email': u.email,
            'role': u.role,
            'name': name,
            'details': details,
            'is_active': u.is_active
        })
    cache_set(cache_key, results, timeout=300)
    return jsonify(results), 200


@app.route('/api/admin/users/<int:user_id>/toggle-status', methods=['POST'])
@admin_required
def api_admin_toggle_user_status(current_user, user_id):
    user = User.query.get_or_404(user_id)
    if user.role == 'admin':
        return jsonify({'error': 'Cannot modify Admin account status.'}), 403

    user.is_active = 0 if user.is_active == 1 else 1
    db.session.commit()
    cache_clear_pattern('admin_stats')
    cache_clear_pattern('admin_users')
    status_str = 'activated' if user.is_active == 1 else 'deactivated/blacklisted'
    return jsonify({'message': f'User {user.email} has been {status_str}.', 'is_active': user.is_active}), 200


@app.route('/api/admin/applications', methods=['GET'])
@admin_required
def api_admin_applications(current_user):
    apps = Application.query.order_by(Application.applied_at.desc()).all()
    results = []
    for a in apps:
        student = User.query.get(a.student_id)
        student_profile = StudentProfile.query.filter_by(user_id=a.student_id).first()
        drive = Drive.query.get(a.drive_id)
        results.append({
            'id': a.id,
            'student_id': a.student_id,
            'student_name': student_profile.full_name if student_profile else 'Unknown',
            'student_email': student.email if student else '',
            'student_code': student_profile.student_id if student_profile else '',
            'drive_id': a.drive_id,
            'job_title': drive.job_title if drive else '',
            'company_name': drive.company_name if drive else '',
            'applied_at': a.applied_at.strftime('%Y-%m-%d %H:%M'),
            'status': a.status,
            'feedback': a.feedback
        })
    return jsonify(results), 200

@app.route('/api/admin/trigger-daily-reminders', methods=['POST'])
@admin_required
def api_admin_trigger_daily_reminders(current_user):
    from tasks import send_daily_reminders
    result = send_daily_reminders()
    return jsonify({
        'message': 'Daily deadline reminders task executed successfully.',
        'result': result
    }), 200

@app.route('/api/admin/trigger-monthly-report', methods=['POST'])
@admin_required
def api_admin_trigger_monthly_report(current_user):
    from tasks import generate_monthly_report
    result = generate_monthly_report()
    return jsonify({
        'message': 'Monthly performance report task executed successfully.',
        'result': result
    }), 200

@app.route('/api/company/profile', methods=['GET'])
@company_required
def api_company_profile(current_user, company_profile):
    return jsonify({
        'id': company_profile.id,
        'user_id': current_user.id,
        'email': current_user.email,
        'company_name': company_profile.company_name_full,
        'industry': company_profile.industry,
        'location': company_profile.location,
        'website': company_profile.website,
        'contact_person': company_profile.contact_person,
        'phone': company_profile.phone,
        'approval_status': company_profile.approval_status
    }), 200

@app.route('/api/company/profile', methods=['PUT'])
@company_required
def api_company_update_profile(current_user, company_profile):
    data = request.get_json() or {}

    if 'company_name' in data:
        company_profile.company_name_full = data['company_name']
    if 'industry' in data:
        company_profile.industry = data['industry']
    if 'location' in data:
        company_profile.location = data['location']
    if 'website' in data:
        company_profile.website = data['website']
    if 'contact_person' in data:
        company_profile.contact_person = data['contact_person']
    if 'phone' in data:
        company_profile.phone = data['phone']

    db.session.commit()
    cache_clear_pattern('admin_companies')
    cache_clear_pattern('admin_stats')
    cache_clear_pattern('public_stats')

    return jsonify({'message': 'Company profile updated successfully!'}), 200


@app.route('/api/company/drives', methods=['GET'])
@company_required
def api_company_get_drives(current_user, company_profile):
    drives = Drive.query.filter_by(company_id=current_user.id).order_by(Drive.created_at.desc()).all()
    results = []
    for d in drives:
        applicant_count = Application.query.filter_by(drive_id=d.id).count()
        results.append({
            'id': d.id,
            'company_name': d.company_name,
            'job_title': d.job_title,
            'description': d.description,
            'skills_required': d.skills_required,
            'salary_range': d.salary_range,
            'eligibility_criteria': d.eligibility_criteria,
            'application_deadline': d.application_deadline.strftime('%Y-%m-%d') if d.application_deadline else None,
            'status': d.status,
            'drive_status': d.drive_status,
            'created_at': d.created_at.strftime('%Y-%m-%d'),
            'applicant_count': applicant_count
        })
    return jsonify(results), 200

@app.route('/api/company/drives', methods=['POST'])
@company_required
def api_company_create_drive(current_user, company_profile):
    data = request.get_json() or {}
    job_title = data.get('job_title')
    description = data.get('description', '')
    skills_required = data.get('skills_required', '')
    salary_range = data.get('salary_range', '')
    eligibility_criteria = data.get('eligibility_criteria', '')
    deadline_str = data.get('application_deadline')

    if not job_title:
        return jsonify({'error': 'Job title is required.'}), 400

    application_deadline = None
    if deadline_str:
        try:
            application_deadline = datetime.strptime(deadline_str, '%Y-%m-%d')
        except ValueError:
            pass

    new_drive = Drive(
        company_id=current_user.id,
        company_name=company_profile.company_name_full or current_user.email,
        job_title=job_title,
        description=description,
        skills_required=skills_required,
        salary_range=salary_range,
        eligibility_criteria=eligibility_criteria,
        application_deadline=application_deadline,
        status='Pending',
        drive_status='Active'
    )
    db.session.add(new_drive)
    db.session.commit()
    cache_clear_pattern('admin_stats')
    cache_clear_pattern('drives_')

    return jsonify({'message': f'Placement drive for "{job_title}" created successfully! Pending Admin approval.'}), 201

@app.route('/api/company/drives/<int:drive_id>', methods=['PUT'])
@company_required
def api_company_update_drive(current_user, company_profile, drive_id):
    drive = Drive.query.filter_by(id=drive_id, company_id=current_user.id).first_or_404()
    data = request.get_json() or {}

    if 'job_title' in data:
        drive.job_title = data['job_title']
    if 'description' in data:
        drive.description = data['description']
    if 'skills_required' in data:
        drive.skills_required = data['skills_required']
    if 'salary_range' in data:
        drive.salary_range = data['salary_range']
    if 'eligibility_criteria' in data:
        drive.eligibility_criteria = data['eligibility_criteria']
    if 'drive_status' in data:
        drive.drive_status = data['drive_status']
    if 'application_deadline' in data and data['application_deadline']:
        try:
            drive.application_deadline = datetime.strptime(data['application_deadline'], '%Y-%m-%d')
        except ValueError:
            pass

    db.session.commit()
    cache_clear_pattern('admin_stats')
    cache_clear_pattern('drives_')
    return jsonify({'message': f'Drive "{drive.job_title}" updated successfully.'}), 200

@app.route('/api/company/drives/<int:drive_id>', methods=['DELETE'])
@company_required
def api_company_delete_drive(current_user, company_profile, drive_id):
    drive = Drive.query.filter_by(id=drive_id, company_id=current_user.id).first_or_404()
    Application.query.filter_by(drive_id=drive_id).delete()
    db.session.delete(drive)
    cache_clear_pattern('admin_stats')
    cache_clear_pattern('drives_')
    return jsonify({'message': 'Placement drive deleted successfully.'}), 200

@app.route('/api/company/drives/<int:drive_id>/export-csv', methods=['POST'])
@token_required
def api_company_export_drive_csv(current_user, drive_id):
    drive = Drive.query.get_or_404(drive_id)
    if current_user.role == 'company' and drive.company_id != current_user.id:
        return jsonify({'error': 'Unauthorized to export data for this drive.'}), 403
    if current_user.role not in ['company', 'admin']:
        return jsonify({'error': 'Access denied.'}), 403

    from tasks import export_drive_applications_csv
    result = export_drive_applications_csv(drive_id, current_user.email)
    return jsonify({
        'message': f'CSV export for "{drive.job_title}" generated successfully.',
        'result': result
    }), 200

@app.route('/api/company/drives/<int:drive_id>/applicants', methods=['GET'])


@company_required
def api_company_get_applicants(current_user, company_profile, drive_id):
    drive = Drive.query.filter_by(id=drive_id, company_id=current_user.id).first_or_404()
    apps = Application.query.filter_by(drive_id=drive_id).order_by(Application.applied_at.desc()).all()

    results = []
    for a in apps:
        student_user = User.query.get(a.student_id)
        student_prof = StudentProfile.query.filter_by(user_id=a.student_id).first()
        results.append({
            'application_id': a.id,
            'student_id': a.student_id,
            'full_name': student_prof.full_name if student_prof else 'Unknown Student',
            'email': student_user.email if student_user else '',
            'student_code': student_prof.student_id if student_prof else '',
            'branch': student_prof.branch if student_prof else '',
            'year': student_prof.year if student_prof else None,
            'cgpa': student_prof.cgpa if student_prof else None,
            'skills': student_prof.skills if student_prof else '',
            'resume_link': student_prof.resume_link if student_prof else '',
            'profile_pic': student_prof.profile_pic if student_prof else 'default.jpg',
            'applied_at': a.applied_at.strftime('%Y-%m-%d %H:%M'),
            'status': a.status,
            'feedback': a.feedback,
            'interview_date': a.interview_date.strftime('%Y-%m-%dT%H:%M') if a.interview_date else None
        })

    return jsonify({
        'drive': {
            'id': drive.id,
            'job_title': drive.job_title,
            'status': drive.status,
            'drive_status': drive.drive_status
        },
        'applicants': results
    }), 200

@app.route('/api/company/applications/<int:app_id>/status', methods=['PUT'])
@company_required
def api_company_update_app_status(current_user, company_profile, app_id):
    application = Application.query.get_or_404(app_id)
    drive = Drive.query.filter_by(id=application.drive_id, company_id=current_user.id).first()
    if not drive:
        return jsonify({'error': 'Unauthorized to update this application.'}), 403

    data = request.get_json() or {}
    new_status = data.get('status')
    feedback = data.get('feedback')
    interview_str = data.get('interview_date')

    if new_status not in ['Applied', 'Shortlisted', 'Selected', 'Rejected']:
        return jsonify({'error': 'Invalid application status.'}), 400

    application.status = new_status
    if feedback is not None:
        application.feedback = feedback

    if interview_str:
        try:
            application.interview_date = datetime.strptime(interview_str, '%Y-%m-%dT%H:%M')
        except ValueError:
            try:
                application.interview_date = datetime.strptime(interview_str, '%Y-%m-%d')
            except ValueError:
                pass

    if new_status == 'Selected':
        existing_placement = Placement.query.filter_by(
            student_id=application.student_id,
            drive_id=application.drive_id
        ).first()
        if not existing_placement:
            placement = Placement(
                student_id=application.student_id,
                company_id=current_user.id,
                drive_id=application.drive_id,
                position=drive.job_title,
                salary=drive.salary_range,
                status='Confirmed'
            )
            db.session.add(placement)

    db.session.commit()
    return jsonify({'message': f'Applicant status updated to "{new_status}".'}), 200

@app.route('/api/student/profile', methods=['GET'])
@student_required
def api_student_get_profile(current_user, student_profile):
    progress = calculate_progress(student_profile)
    return jsonify({
        'id': student_profile.id,
        'user_id': current_user.id,
        'email': current_user.email,
        'full_name': student_profile.full_name or '',
        'student_id': student_profile.student_id or '',
        'branch': student_profile.branch or '',
        'year': student_profile.year or '',
        'cgpa': student_profile.cgpa or '',
        'skills': student_profile.skills or '',
        'resume_link': student_profile.resume_link or '',
        'profile_pic': student_profile.profile_pic or '',
        'placement_status': student_profile.placement_status or 'Looking for Placement',
        'progress_percent': progress
    }), 200

@app.route('/api/student/profile', methods=['PUT'])
@student_required
def api_student_update_profile(current_user, student_profile):
    data = request.get_json() or {}
    if 'full_name' in data:
        student_profile.full_name = data['full_name']
    if 'student_id' in data:
        student_profile.student_id = data['student_id']
    if 'branch' in data:
        student_profile.branch = data['branch']
    if 'year' in data:
        student_profile.year = data['year']
    if 'cgpa' in data:
        try:
            student_profile.cgpa = float(data['cgpa']) if data['cgpa'] is not None and str(data['cgpa']).strip() != '' else None
        except ValueError:
            pass
    if 'skills' in data:
        student_profile.skills = data['skills']
    if 'resume_link' in data:
        student_profile.resume_link = data['resume_link']
    if 'placement_status' in data:
        student_profile.placement_status = data['placement_status']

    db.session.commit()
    return jsonify({
        'message': 'Student profile updated successfully!',
        'progress_percent': calculate_progress(student_profile)
    }), 200

@app.route('/api/student/upload-photo', methods=['POST'])
@student_required
def api_student_upload_photo(current_user, student_profile):
    if 'profile_pic' not in request.files:
        return jsonify({'error': 'No file part in request.'}), 400
    file = request.files['profile_pic']
    if file.filename == '':
        return jsonify({'error': 'No image selected.'}), 400
    
    upload_folder = os.path.join(app.root_path, 'static', 'uploads')
    os.makedirs(upload_folder, exist_ok=True)
    
    filename = secure_filename(f"user_{current_user.id}_{file.filename}")
    filepath = os.path.join(upload_folder, filename)
    file.save(filepath)
    
    student_profile.profile_pic = f"/static/uploads/{filename}"
    db.session.commit()
    
    return jsonify({
        'message': 'Profile photo uploaded successfully!',
        'profile_pic': student_profile.profile_pic
    }), 200

@app.route('/api/student/drives', methods=['GET'])
@student_required
def api_student_get_drives(current_user, student_profile):
    query_str = request.args.get('query', '').strip()
    cache_key = f"drives_student_{current_user.id}_{query_str}"
    cached_drives = cache_get(cache_key)
    if cached_drives is not None:
        return jsonify(cached_drives), 200

    base_query = Drive.query.filter_by(status='Approved', drive_status='Active')
    if query_str:
        search = f"%{query_str}%"
        base_query = base_query.filter(
            (Drive.job_title.ilike(search)) |
            (Drive.skills_required.ilike(search)) |
            (Drive.description.ilike(search))
        )
    
    approved_drives = base_query.order_by(Drive.created_at.desc()).all()
    
    applied_drive_ids = set(
        app_rec.drive_id for app_rec in Application.query.filter_by(student_id=current_user.id).all()
    )
    
    drives_data = []
    for d in approved_drives:
        comp_profile = CompanyProfile.query.filter_by(user_id=d.company_id).first()
        company_name = comp_profile.company_name_full if comp_profile and comp_profile.company_name_full else "Corporate Partner"
        
        drives_data.append({
            'id': d.id,
            'company_id': d.company_id,
            'company_name': company_name,
            'job_title': d.job_title,
            'salary_range': d.salary_range,
            'skills_required': d.skills_required,
            'eligibility_criteria': d.eligibility_criteria,
            'description': d.description,
            'application_deadline': d.application_deadline.strftime('%Y-%m-%d') if d.application_deadline else None,
            'has_applied': d.id in applied_drive_ids
        })
        
    cache_set(cache_key, drives_data, timeout=300)
    return jsonify(drives_data), 200


@app.route('/api/student/apply/<int:drive_id>', methods=['POST'])
@student_required
def api_student_apply_drive(current_user, student_profile, drive_id):
    drive = Drive.query.get_or_404(drive_id)
    if drive.status != 'Approved' or drive.drive_status != 'Active':
        return jsonify({'error': 'This placement drive is not currently active.'}), 400

    existing_app = Application.query.filter_by(student_id=current_user.id, drive_id=drive_id).first()
    if existing_app:
        return jsonify({'error': 'You have already applied to this placement drive.'}), 400

    new_app = Application(
        student_id=current_user.id,
        drive_id=drive_id,
        status='Applied'
    )
    db.session.add(new_app)
    db.session.commit()
    return jsonify({'message': f'Successfully applied for "{drive.job_title}"!'}), 201

@app.route('/api/student/applications', methods=['GET'])
@student_required
def api_student_get_applications(current_user, student_profile):
    apps = Application.query.filter_by(student_id=current_user.id).order_by(Application.applied_at.desc()).all()
    results = []
    for a in apps:
        drive = Drive.query.get(a.drive_id)
        comp_profile = CompanyProfile.query.filter_by(user_id=drive.company_id).first() if drive else None
        company_name = comp_profile.company_name_full if comp_profile and comp_profile.company_name_full else 'Corporate Partner'
        
        results.append({
            'application_id': a.id,
            'drive_id': a.drive_id,
            'job_title': drive.job_title if drive else 'N/A',
            'company_name': company_name,
            'salary_range': drive.salary_range if drive else 'N/A',
            'status': a.status,
            'feedback': a.feedback or '',
            'interview_date': a.interview_date.strftime('%Y-%m-%d %H:%M') if a.interview_date else None,
            'applied_at': a.applied_at.strftime('%Y-%m-%d') if a.applied_at else ''
        })
    return jsonify(results), 200

@app.route('/api/student/placements', methods=['GET'])
@student_required
def api_student_get_placements(current_user, student_profile):
    placements = Placement.query.filter_by(student_id=current_user.id).order_by(Placement.created_at.desc()).all()
    results = []
    for p in placements:
        comp_profile = CompanyProfile.query.filter_by(user_id=p.company_id).first()
        company_name = comp_profile.company_name_full if comp_profile and comp_profile.company_name_full else 'Corporate Partner'
        results.append({
            'id': p.id,
            'company_name': company_name,
            'position': p.position,
            'salary': p.salary,
            'status': p.status,
            'selected_at': p.created_at.strftime('%Y-%m-%d') if p.created_at else ''
        })
    return jsonify(results), 200



@app.route('/')

def home():
    return render_template('index.html')

if __name__ == '__main__':
    from init_db import init_database
    init_database()
    app.run(debug=True)

