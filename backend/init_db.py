import os
import sys

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from models import User, Drive, CompanyProfile, StudentProfile, Application, Placement

def init_database():
    with app.app_context():
        # Create all database tables
        db.create_all()
        print(f"Database {app.config.get('SQLALCHEMY_DATABASE_URI')} initialized successfully!")

        # Check and create default admin user
        admin_exists = User.query.filter_by(role='admin').first()
        if not admin_exists:
            admin = User(
                email='admin@institute.com',
                role='admin'
            )
            admin.set_password('admin123')
            db.session.add(admin)
            db.session.commit()
            print("Default Admin created successfully: admin@institute.com / admin123")
        else:
            print("Admin user already exists in database.")

if __name__ == '__main__':
    init_database()