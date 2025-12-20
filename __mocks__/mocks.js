const idFieldMock = {
    column_name: "id",
    column_default: "nextval('test_id_seq'::regclass)",
    is_nullable: "NO",
    data_type: "integer",
};

const nameFieldMock = {
    column_name: "name",
    column_default: null,
    is_nullable: "NO",
    data_type: "character varying",
};

const jobFieldMock = {
    column_name: "job",
    column_default: "chemist",
    is_nullable: "YES",
    data_type: "character varying",
};

const ageFieldMock = {
    column_name: "age",
    column_default: null,
    is_nullable: "YES",
    data_type: "integer",
};

const gpaFieldMock = {
    column_name: "gpa",
    column_default: null,
    is_nullable: "YES",
    data_type: "decimal",
};

const dateFieldMock = {
    column_name: "date_of_birth",
    column_default: null,
    is_nullable: "NO",
    data_type: "date",
};

const users = [
    { name: "Micah", age: 29, job: "rat" },
    { name: "Gustavo", age: 32, job: null },
    { name: "Gustavo", age: null, job: null },
];

const joinedUsers = [
    { name: "Micah", address: "Some city" },
    { name: "Gustavo", address: "Another city" },
    { name: "Gustavo", address: "Yet another city" },
];

export {
    idFieldMock,
    nameFieldMock,
    ageFieldMock,
    jobFieldMock,
    gpaFieldMock,
    dateFieldMock,
    users,
    joinedUsers,
};
