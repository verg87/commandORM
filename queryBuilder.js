export class QueryBuilder {
    constructor() {
        this._select = [];
        this._where = [];
        this._order = [];
        this._returning = [];
        this._desc = false;
        this._alter = [];
    }

    /**
     * Specifies the columns to select. Calling with no arguments defaults to selecting all columns.
     * @param  {...string} columns The columns to select.
     * @returns {QueryBuilder} The QueryBuilder instance.
     */
    select(...columns) {
        this._select = columns?.length ? columns.filter((col) => col !== '*') : ['*'];
        return this;
    }

    /**
     * Adds a where clause to the query.
     * @param {Function(object): boolean} condition A function to filter the rows.
     * @returns {QueryBuilder} The QueryBuilder instance.
     */
    where(condition) {
        this._where.push(condition);
        return this;
    }

    /**
     * Specifies the columns to return.
     * @param  {...string} columns The columns to return.
     * @returns {QueryBuilder} The QueryBuilder instance.
     */
    returning(...columns) {
        this._returning = columns?.length ? columns.filter((col) => col !== '*') : ['*'];
        return this;
    }

    /**
     * Specifies the columns to order by.
     * @param  {...string} columns The columns to order by.
     * @returns {QueryBuilder} The QueryBuilder instance.
     */
    orderBy(...columns) {
        this._order = columns?.length ? columns.filter((col) => col !== '*') : ['*'];
        return this;
    }

    /**
     * Specifies that the order should be descending.
     * @returns {QueryBuilder} The QueryBuilder instance.
     */
    desc() {
        this._desc = true;
        return this;
    }

    /**
     * Specifies the columns to alter. Calling it with no arguments will default to choosing all columns.
     * @param  {...string} columns The columns to alter.
     * @returns {QueryBuilder} The QueryBuilder instance.
     */
    alter(...columns) {
        this._alter = columns?.length ? columns : ['*'];
        return this;
    }
}