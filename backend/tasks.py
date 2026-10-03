import os
import csv
from datetime import datetime, timedelta

from celery_app import celery_app

@celery_app.task(name='tasks.send_daily_reminders')
def send_daily_reminders():
    from app import app, db
    from models import Drive, User, StudentProfile, Application

    reminders_sent = 0
    drives_checked = 0

    with app.app_context():
        now = datetime.utcnow()
        near_deadline = now + timedelta(days=2)

        # Query drives approved, active
        impending_drives = Drive.query.filter(
            Drive.status == 'Approved',
            Drive.drive_status == 'Active',
            Drive.application_deadline != None,
            Drive.application_deadline <= near_deadline,
            Drive.application_deadline >= now
        ).all()

        drives_checked = len(impending_drives)
        student_users = User.query.filter_by(role='student', is_active=1).all()

        for drive in impending_drives:
            applied_student_ids = set(
                app_rec.student_id for app_rec in Application.query.filter_by(drive_id=drive.id).all()
            )

            for stu_user in student_users:
                stu_profile = StudentProfile.query.filter_by(user_id=stu_user.id).first()
                if stu_profile and stu_profile.placement_status == 'Opted Out':
                    continue

                if stu_user.id not in applied_student_ids:
                    # email reminder
                    print(f"[DAILY REMINDER EMAIL] Sent to {stu_user.email} for Drive: '{drive.job_title}' (Deadline: {drive.application_deadline})")
                    reminders_sent += 1

    return {
        'status': 'success',
        'drives_checked': drives_checked,
        'reminders_sent': reminders_sent,
        'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    }

@celery_app.task(name='tasks.generate_monthly_report')
def generate_monthly_report():
    from app import app, db
    from models import Drive, Application, Placement, CompanyProfile, User, StudentProfile

    with app.app_context():
        now = datetime.utcnow()
        month_str = now.strftime('%B %Y')
        report_filename = f"monthly_report_{now.strftime('%Y_%m')}.html"

        total_drives = Drive.query.count()
        approved_drives = Drive.query.filter_by(status='Approved').count()
        total_apps = Application.query.count()
        selected_apps = Application.query.filter_by(status='Selected').count()
        total_placements = Placement.query.count()
        total_students = User.query.filter_by(role='student').count()

        # HTML Report Content
        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Ascentia Monthly Placement Report - {month_str}</title>
    <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; color: #0f172a; padding: 2rem; }}
        .report-card {{ max-width: 800px; margin: auto; background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }}
        .header {{ border-bottom: 2px solid #7e22ce; padding-bottom: 1rem; margin-bottom: 1.5rem; }}
        .stat-grid {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.5rem; }}
        .stat-box {{ background: #f5f3ff; border: 1px solid #e9d5ff; padding: 1rem; border-radius: 8px; }}
        .stat-num {{ font-size: 1.8rem; font-weight: bold; color: #581c87; }}
    </style>
</head>
<body>
    <div class="report-card">
        <div class="header">
            <h2>Ascentia Institute Placement Cell</h2>
            <h4>Monthly Performance Report - {month_str}</h4>
            <small>Generated on: {now.strftime('%Y-%m-%d %H:%M:%S UTC')}</small>
        </div>

        <div class="stat-grid">
            <div class="stat-box">
                <div>Total Placement Drives</div>
                <div class="stat-num">{total_drives} ({approved_drives} Approved)</div>
            </div>
            <div class="stat-box">
                <div>Total Candidate Applications</div>
                <div class="stat-num">{total_apps}</div>
            </div>
            <div class="stat-box">
                <div>Selected Candidates</div>
                <div class="stat-num">{selected_apps}</div>
            </div>
            <div class="stat-box">
                <div>Confirmed Placements</div>
                <div class="stat-num">{total_placements}</div>
            </div>
        </div>

        <p class="text-muted">Ascentia Placement Cell — Automated Monthly Analytics Summary.</p>
    </div>
</body>

</html>
"""
        reports_dir = os.path.join(app.root_path, 'static', 'reports')
        os.makedirs(reports_dir, exist_ok=True)
        report_path = os.path.join(reports_dir, report_filename)

        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(html_content)

        report_url = f"/static/reports/{report_filename}"

    return {
        'status': 'success',
        'month': month_str,
        'report_url': report_url,
        'total_drives': total_drives,
        'total_applications': total_apps,
        'total_placements': total_placements,
        'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    }

@celery_app.task(name='tasks.export_drive_applications_csv')
def export_drive_applications_csv(drive_id, recipient_email=''):
    from app import app, db
    from models import Drive, Application, StudentProfile, User

    with app.app_context():
        drive = Drive.query.get(drive_id)
        if not drive:
            return {'status': 'error', 'message': 'Drive not found'}

        apps = Application.query.filter_by(drive_id=drive_id).all()
        exports_dir = os.path.join(app.root_path, 'static', 'exports')
        os.makedirs(exports_dir, exist_ok=True)

        filename = f"drive_{drive_id}_applicants.csv"
        filepath = os.path.join(exports_dir, filename)

        headers = [
            'Application ID', 'Candidate Name', 'Email', 'Student Roll ID',
            'Branch', 'Academic Year', 'CGPA', 'Skills',
            'Application Status', 'Applied Date', 'Interview Schedule', 'Feedback'
        ]

        rows = []
        for a in apps:
            student_user = User.query.get(a.student_id)
            student_profile = StudentProfile.query.filter_by(user_id=a.student_id).first()
            
            rows.append([
                a.id,
                student_profile.full_name if student_profile else 'Unknown',
                student_user.email if student_user else '',
                student_profile.student_id if student_profile else '',
                student_profile.branch if student_profile else '',
                student_profile.year if student_profile else '',
                student_profile.cgpa if student_profile else '',
                student_profile.skills if student_profile else '',
                a.status,
                a.applied_at.strftime('%Y-%m-%d %H:%M') if a.applied_at else '',
                a.interview_date.strftime('%Y-%m-%d %H:%M') if a.interview_date else '',
                a.feedback or ''
            ])

        with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(headers)
            writer.writerows(rows)

        download_url = f"/static/exports/{filename}"

    return {
        'status': 'success',
        'drive_id': drive_id,
        'job_title': drive.job_title,
        'download_url': download_url,
        'total_records': len(rows),
        'timestamp': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    }

