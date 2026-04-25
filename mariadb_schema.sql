-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id CHAR(36) PRIMARY KEY DEFAULT UUID(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    status ENUM('active', 'suspended', 'trialing') DEFAULT 'active',
    logo_url TEXT,
    primary_color VARCHAR(50) DEFAULT '#6366f1',
    secondary_color VARCHAR(50) DEFAULT '#4f46e5',
    enabled_modules JSON DEFAULT ('["patients", "doctors", "appointments", "billing", "pharmacy", "staff", "inventory", "lab"]'),
    settings JSON DEFAULT ('{}'),
    app_theme JSON DEFAULT ('{}'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Ensure app_theme exists for older runs
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS app_theme JSON DEFAULT ('{}');

-- Seed a default organization so UI Themes and Sidebar load
INSERT IGNORE INTO organizations (id, name, slug) VALUES ('00000000-0000-0000-0000-000000000000', 'Wise Health Center', 'main');


-- Users
CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY DEFAULT UUID(),
    organization_id CHAR(36),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    department VARCHAR(100),
    profile_pic TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Other basic tables required by routes
CREATE TABLE IF NOT EXISTS settings (
    id CHAR(36) PRIMARY KEY DEFAULT UUID(),
    organization_id CHAR(36),
    key_name VARCHAR(100) NOT NULL,
    value JSON,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS categories (
    id CHAR(36) PRIMARY KEY DEFAULT UUID(),
    organization_id CHAR(36),
    name VARCHAR(255),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS patients (
    id CHAR(36) PRIMARY KEY DEFAULT UUID(),
    organization_id CHAR(36),
    user_id CHAR(36),
    full_name VARCHAR(255),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS staff (
    id CHAR(36) PRIMARY KEY DEFAULT UUID(),
    organization_id CHAR(36),
    user_id CHAR(36),
    full_name VARCHAR(255),
    designation VARCHAR(100),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Ensure staff patients tables have user_ids
ALTER TABLE patients ADD COLUMN IF NOT EXISTS user_id CHAR(36);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS medical_history TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS patient_type VARCHAR(50);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS assigned_doctor_id CHAR(36);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS user_id CHAR(36);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS shift_start VARCHAR(50);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS shift_end VARCHAR(50);
ALTER TABLE staff ADD COLUMN IF NOT EXISTS joined_date DATE;

CREATE TABLE IF NOT EXISTS doctors (
    id CHAR(36) PRIMARY KEY DEFAULT UUID(),
    organization_id CHAR(36),
    user_id CHAR(36),
    full_name VARCHAR(255),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Ensure users have all profile columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(50);

-- Ensure doctors table is fully fleshed out
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS user_id CHAR(36);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS specialization VARCHAR(255);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS availability VARCHAR(255);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS website_url VARCHAR(255);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS department VARCHAR(255);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS designation VARCHAR(255);

CREATE TABLE IF NOT EXISTS appointments (
    id CHAR(36) PRIMARY KEY DEFAULT UUID(),
    organization_id CHAR(36),
    patient_id CHAR(36),
    doctor_id CHAR(36),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);
