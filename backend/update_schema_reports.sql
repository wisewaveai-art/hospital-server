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
