-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    status ENUM('active', 'suspended', 'trialing') DEFAULT 'active',
    logo_url TEXT,
    primary_color VARCHAR(50) DEFAULT '#6366f1',
    secondary_color VARCHAR(50) DEFAULT '#4f46e5',
    enabled_modules JSON DEFAULT ('["patients", "doctors", "appointments", "billing", "pharmacy", "staff", "inventory", "lab"]'),
    settings JSON DEFAULT ('{}'),
    app_theme JSON DEFAULT ('{}'),
    site_config JSON,
    site_builder_enabled BOOLEAN DEFAULT TRUE,
    custom_home_content TEXT,
    db_name VARCHAR(100), -- Store the name of the dedicated database here
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Ensure db_name column exists for existing tables
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS db_name VARCHAR(100) AFTER custom_home_content;

INSERT IGNORE INTO organizations (id, name, slug, db_name) VALUES ('0001-0000-00001', 'Wise Health Center', 'main', 'wisehospital');

-- Branches
CREATE TABLE IF NOT EXISTS branches (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    contact_number VARCHAR(50),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    department VARCHAR(100),
    phone VARCHAR(50),
    address TEXT,
    gender VARCHAR(50),
    profile_pic TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    key_name VARCHAR(100) NOT NULL,
    value JSON,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Categories (Medicine/Pharmacy)
CREATE TABLE IF NOT EXISTS categories (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    name VARCHAR(255),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Patients
CREATE TABLE IF NOT EXISTS patients (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    user_id CHAR(36),
    blood_group VARCHAR(10),
    dob DATE,
    medical_history TEXT,
    emergency_contact VARCHAR(100),
    patient_type VARCHAR(50),
    assigned_doctor_id CHAR(36),
    allergies TEXT,
    chronic_diseases TEXT,
    current_medications TEXT,
    insurance_provider VARCHAR(100),
    insurance_number VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Patient Vitals
CREATE TABLE IF NOT EXISTS patient_vitals (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    patient_id CHAR(36),
    recorded_by CHAR(36),
    blood_pressure VARCHAR(50),
    heart_rate INT,
    temperature DECIMAL(5,2),
    oxygen_saturation DECIMAL(5,2),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Doctors
CREATE TABLE IF NOT EXISTS doctors (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    branch_id CHAR(36) NULL,
    user_id CHAR(36),
    specialization VARCHAR(255),
    bio TEXT,
    availability VARCHAR(255),
    website_url VARCHAR(255),
    department VARCHAR(255),
    designation VARCHAR(255),
    base_salary DECIMAL(12,2) DEFAULT 0.00,
    payment_type VARCHAR(50) DEFAULT 'monthly',
    bank_account_details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Staff (Nurses/Other)
CREATE TABLE IF NOT EXISTS staff (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    user_id CHAR(36),
    designation VARCHAR(100),
    shift_start VARCHAR(50),
    shift_end VARCHAR(50),
    joined_date DATE,
    base_salary DECIMAL(12,2) DEFAULT 0.00,
    payment_type VARCHAR(50) DEFAULT 'monthly',
    bank_account_details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Medicines / Pharmacy
CREATE TABLE IF NOT EXISTS medicines (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    product_code VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255),
    hsn_code VARCHAR(100),
    category_id CHAR(36),
    strength VARCHAR(100),
    unit VARCHAR(100),
    quantity INT DEFAULT 0,
    expiry_date DATE,
    price_per_unit DECIMAL(10,2) DEFAULT 0.00,
    batch_number VARCHAR(100),
    gst_percentage DECIMAL(5,2) DEFAULT 0.00,
    low_stock_threshold INT DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Appointments
CREATE TABLE IF NOT EXISTS appointments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    branch_id CHAR(36) NULL,
    patient_user_id CHAR(36),
    doctor_id CHAR(36),
    appointment_date DATETIME,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
    FOREIGN KEY (patient_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

-- Visits (Reports / History)
CREATE TABLE IF NOT EXISTS patient_visits (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    patient_id CHAR(36),
    doctor_id CHAR(36),
    visit_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    next_visit_date DATETIME,
    complaint TEXT,
    diagnosis TEXT,
    secondary_diagnosis TEXT,
    investigation_orders JSON,
    referral_to VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL
);

-- Patient Vitals
CREATE TABLE IF NOT EXISTS patient_vitals (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    patient_id CHAR(36),
    recorded_by CHAR(36),
    blood_pressure VARCHAR(20),
    heart_rate INT,
    temperature DECIMAL(5,2),
    oxygen_saturation INT,
    respiratory_rate INT,
    weight DECIMAL(5,2),
    height DECIMAL(5,2),
    notes TEXT,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Patient Investigation Reports (PDFs)
CREATE TABLE IF NOT EXISTS patient_reports (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    patient_id CHAR(36),
    uploaded_by CHAR(36),
    report_name VARCHAR(255),
    file_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Lab Reports
CREATE TABLE IF NOT EXISTS lab_reports (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    report_id VARCHAR(100),
    patient_id CHAR(36),
    doctor_id CHAR(36),
    test_category VARCHAR(255),
    test_name VARCHAR(255),
    sample_type VARCHAR(100),
    department VARCHAR(100),
    collection_date DATETIME,
    technician_name VARCHAR(255),
    result_parameters JSON,
    status VARCHAR(50) DEFAULT 'Pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL
);

-- Billing: Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    patient_id CHAR(36),
    subtotal DECIMAL(12,2) DEFAULT 0.00,
    discount DECIMAL(12,2) DEFAULT 0.00,
    tax_percentage DECIMAL(5,2) DEFAULT 0.00,
    amount DECIMAL(12,2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'Pending',
    invoice_number VARCHAR(100) UNIQUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- Billing: Invoice Items
CREATE TABLE IF NOT EXISTS invoice_items (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    invoice_id CHAR(36),
    description VARCHAR(255) NOT NULL,
    quantity INT DEFAULT 1,
    unit_price DECIMAL(10,2) DEFAULT 0.00,
    total_price DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- Billing: Payments
CREATE TABLE IF NOT EXISTS payments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    invoice_id CHAR(36),
    amount DECIMAL(12,2) DEFAULT 0.00,
    payment_method VARCHAR(50),
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- Services
CREATE TABLE IF NOT EXISTS services (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cost DECIMAL(10,2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    room_number VARCHAR(50) NOT NULL,
    room_type VARCHAR(100),
    capacity INT DEFAULT 1,
    status VARCHAR(50) DEFAULT 'available',
    price_per_day DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Room Allocations (IPD)
CREATE TABLE IF NOT EXISTS room_allocations (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    room_id CHAR(36),
    patient_id CHAR(36),
    admission_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    discharge_date DATETIME,
    status VARCHAR(50) DEFAULT 'active',
    guest_name VARCHAR(255),
    guest_contact VARCHAR(255),
    notes TEXT,
    admitting_doctor_id CHAR(36),
    reason_for_admission TEXT,
    discharge_notes TEXT,
    discharge_condition VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- Operations / Surgery
CREATE TABLE IF NOT EXISTS operations (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    patient_id CHAR(36),
    doctor_id CHAR(36),
    operation_name VARCHAR(255),
    operation_date DATETIME,
    status VARCHAR(50) DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS operation_participants (
    operation_id CHAR(36),
    user_id CHAR(36),
    role VARCHAR(50),
    PRIMARY KEY (operation_id, user_id),
    FOREIGN KEY (operation_id) REFERENCES operations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Instruments / Assets
CREATE TABLE IF NOT EXISTS instruments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    name VARCHAR(255) NOT NULL,
    purchase_date DATE,
    next_service_date DATE,
    warranty_expiry DATE,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Ambulances
CREATE TABLE IF NOT EXISTS ambulances (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    vehicle_number VARCHAR(50) NOT NULL,
    vehicle_model VARCHAR(100),
    driver_name VARCHAR(255),
    driver_phone VARCHAR(50),
    ambulance_type VARCHAR(50) DEFAULT 'Basic',
    status VARCHAR(50) DEFAULT 'available',
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Diagnostic Labs (Linked External Labs)
CREATE TABLE IF NOT EXISTS diagnostic_labs (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    lab_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    status VARCHAR(50) DEFAULT 'active',
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Prescriptions
CREATE TABLE IF NOT EXISTS prescriptions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    visit_id CHAR(36),
    medicine_id CHAR(36),
    dosage VARCHAR(255),
    duration VARCHAR(100),
    quantity INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (visit_id) REFERENCES patient_visits(id) ON DELETE CASCADE,
    FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
);

-- HR: Leave Requests
CREATE TABLE IF NOT EXISTS leave_requests (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    user_id CHAR(36),
    leave_type VARCHAR(50),
    start_date DATE,
    end_date DATE,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    approved_by CHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- HR: Payroll
CREATE TABLE IF NOT EXISTS payroll (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    user_id CHAR(36),
    salary_month VARCHAR(20),
    base_salary DECIMAL(12,2) DEFAULT 0.00,
    allowances DECIMAL(12,2) DEFAULT 0.00,
    deductions DECIMAL(12,2) DEFAULT 0.00,
    net_salary DECIMAL(12,2) DEFAULT 0.00,
    payment_status VARCHAR(50) DEFAULT 'pending',
    payment_date DATE,
    transaction_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Attendance Tracking
CREATE TABLE IF NOT EXISTS attendance (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    user_id CHAR(36),
    date DATE NOT NULL,
    check_in_time DATETIME,
    check_out_time DATETIME,
    shift VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Present',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY (user_id, date)
);

-- Financials: Expenses
CREATE TABLE IF NOT EXISTS expenses (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    category VARCHAR(100), -- 'Utility', 'Maintenance', 'Medical Supplies', 'Salary', 'Other'
    description TEXT,
    amount DECIMAL(15,2) DEFAULT 0.00,
    expense_date DATE NOT NULL,
    payment_method VARCHAR(50), -- 'Cash', 'Bank Transfer', 'Credit Card'
    status VARCHAR(50) DEFAULT 'Paid',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Inpatient Assignments
CREATE TABLE IF NOT EXISTS inpatient_assignments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    organization_id CHAR(36),
    patient_id CHAR(36),
    user_id CHAR(36),
    role VARCHAR(50),
    assigned_by CHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    relieved_at DATETIME NULL
);
