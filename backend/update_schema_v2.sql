-- Create Categories table
create table categories (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  created_at timestamp default now()
);

-- Insert default categories
insert into categories (name) values ('Tablet'), ('Syrup'), ('Injection'), ('Cream'), ('Drops');

-- Alter Medicines table
alter table medicines 
  add column product_code text, -- We will generate this in backend (P1, P2...)
  add column generic_name text,
  add column hsn_code text,
  add column category_id uuid references categories(id),
  add column strength text, -- e.g. "500", "650"
  add column unit text, -- e.g. "Strip", "Bottle"
  add column low_stock_threshold integer default 10,
  add column gst_percentage numeric(5, 2) default 0;

-- Drop old 'type' column as we are using categories now (optional, but cleaner)
-- alter table medicines drop column type;
