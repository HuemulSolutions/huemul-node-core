import { hasValue, isEmpty, sqlInjectionValidation, toBoolean } from "../functions/huemul-functions";
import { sanitizeSqlText } from "../global";
import { HuemulColumnClass, HuemulFilterBase, HuemulFilterOperators, IHuemulFilterValues } from "../interfaces/interface-huemul-filter";

export enum SqlWhereConnector {
    INCLUDE_WHERE = "where",
    INCLUDE_AND = "and",
    INCLUDE_NONE = "",
}

export enum SqlCompareType {
    EQUAL = "EQUAL",
    LIKE = "LIKE",
    NONE = "NONE",
}

export class HuemulFilterGroup {
    groupIndex: number;
    connectorWithPrevious: 'AND' | 'OR';

    //constructor
    constructor(groupIndex: number, connectorWithPrevious: 'AND' | 'OR' = 'AND') {
        this.groupIndex = groupIndex;
        this.connectorWithPrevious = connectorWithPrevious;
    }
}


export class HuemulFilters {
    //[key: string]: any;
    //whereList: IHuemulFilter<any>[] = [];
    aliasBase: string = "base";

    groupConfig: HuemulFilterGroup[] = [new HuemulFilterGroup(0)]; // Array to hold group configurations


    /**
     * Check if the provided filter is a valid IHuemulFilterBase
     * @param filter - The filter to check
     * @returns boolean - True if the filter is valid, false otherwise
     */
    isValidFilter(filter: any): boolean {
        if (typeof filter == 'object' && filter !== null) {
            // Check if it is an IHuemulFilterBase
            if (Object.hasOwn(filter, 'values')) {
                return true;
            } else {
                // If not, return undefined
                return false;
            }
        }
        return false;
    }

    /**
     * Get the names of properties that are valid filters
     * @returns string[] - Array of property names that are valid filters
     */
    getMyColumnNames(): string[] {
        const properties: string[] = [];
        for (const key in this) {
            //hasOwnProperty and is not a function
            if (Object.hasOwn(this, key) && typeof this[key] === 'object') {
                properties.push(key);
            }
        }

        return properties;
    }


    /**
     * get property by name and type==IHuemulFilterBase
     * @param columnName 
     * @returns 
     */
    getPropertyByName(columnName: string): HuemulFilterBase<any> | undefined {
        if (isEmpty(columnName)) {
            return undefined;
        }

        // forzamos que this sea accesible como un mapa string → unknown
        const candidate = (this as Record<string, unknown>)[columnName];

        const properties = this.getMyColumnNames();
        if (properties.includes(columnName)) {
            if (this.isValidFilter(candidate)) {
                return candidate as HuemulFilterBase<any>;
            }
            return undefined;
        }

        return undefined;
    }

    isString(value: any): boolean {
        return typeof value === 'string' || value instanceof String;
    }
    isBoolean(value: any): boolean {
        return typeof value === 'boolean' || value instanceof Boolean;
    }
    isNumber(value: any): boolean {
        return typeof value === 'number' && isFinite(value);
    }

    _createSentence(tableAlias: string, columnAlias: string, operator: string, myValue: any, convertToUpperCase: boolean): string {
        var sqlSentence = `${isEmpty(tableAlias) ? "" : `"${tableAlias}".`}"${columnAlias}" ${operator} ${myValue}`;
        if (convertToUpperCase) {
            sqlSentence = `UPPER(${isEmpty(tableAlias) ? "" : `"${tableAlias}".`}"${columnAlias}") ${operator} ${myValue}`;
        }

        return sqlSentence;
    }

    _createInOrNotInSql(tableAlias: string, columnName: string, columnAlias: string, operator: HuemulFilterOperators, inValues: IHuemulFilterValues<any>[] , convertToUpperCase: boolean): string {
        const values = inValues.map((e: IHuemulFilterValues<any>) => {
            if (this.isString(e.value)) {
                var myValue = `${e.value}`;
                if (convertToUpperCase) {
                    //convert to upper
                    myValue = myValue.toUpperCase();
                }

                return `'${sanitizeSqlText(myValue)}'`;
            } else if (this.isBoolean(e.value)) {
                return e.value ? 'true' : 'false';
            } else if (this.isNumber(e.value)) {
                return e.value.toString();
            } else {
                throw new Error(`Unsupported value type for column ${columnName} ${isEmpty(columnAlias) ? "" : `(alias: ${columnAlias})` }: ${typeof e.value}`);
            }
        }).join(",");

        var sqlFinal = this._createSentence(tableAlias, columnAlias,operator, `(${values})`, convertToUpperCase);

        return sqlFinal;
    }

    getWhereClause(columnListToInclude?: string[], columnListToExclude?: string[], includeType: SqlWhereConnector = SqlWhereConnector.INCLUDE_WHERE): string {
        let columnList = this.getMyColumnNames();
        if (columnList.length === 0) {
            return "";
        }

        if (columnListToInclude != null) {
            // Filter the columnList to include only the specified columns
            columnList = columnList.filter(column => columnListToInclude.includes(column));

            //keep only the columns that are valid filters
            columnList = columnList.filter(column => {
                const myFilter = this.getPropertyByName(column);
                return myFilter !== undefined && this.isValidFilter(myFilter) && myFilter.values.length > 0;
            });
        }

        if (columnListToExclude != null) {
            // Filter the columnList to exclude the specified columns
            columnList = columnList.filter(column => !columnListToExclude.includes(column));
        }


        let whereFinal: string = "";

        //iterate over each group defined
        for (const group of this.groupConfig) {

            const whereClauses: string[] = [];
            for (const columnName of columnList) {
                let whereColumn = "";
                let whereColumnIn = "";
                let wherecolumnNotIn = "";
                const myFilter = this.getPropertyByName(columnName);
                if (myFilter === undefined || this.isValidFilter(myFilter) === false) {
                    continue;    
                } 
                if (myFilter.values.length === 0) {
                    continue; // No values to filter
                }

                var myValues = myFilter.values.filter((e: IHuemulFilterValues<any>) => e.whereGroup == group.groupIndex);

                //check count for operator type
                var countEquals = myValues.filter((e: IHuemulFilterValues<any>) => e.operator === HuemulFilterOperators.EQUALS).length;
                var countNotEquals = myValues.filter((e: IHuemulFilterValues<any>) => e.operator === HuemulFilterOperators.NOT_EQUALS).length;
                //var countGreaterThan = myValues.filter((e: IHuemulFilterValues<any>) => e.operator === HuemulFilterOperators.GREATER_THAN).length;
                //var countGreaterThanOrEqual = myValues.filter((e: IHuemulFilterValues<any>) => e.operator === HuemulFilterOperators.GREATER_THAN_OR_EQUAL).length;
                //var countLessThan = myValues.filter((e: IHuemulFilterValues<any>) => e.operator === HuemulFilterOperators.LESS_THAN).length;
                //var countLessThanOrEqual = myValues.filter((e: IHuemulFilterValues<any>) => e.operator === HuemulFilterOperators.LESS_THAN_OR_EQUAL).length;
                //var countLike = myValues.filter((e: IHuemulFilterValues<any>) => e.operator === HuemulFilterOperators.LIKE).length;
                //var countIsNull = myValues.filter((e: IHuemulFilterValues<any>) => e.operator === HuemulFilterOperators.IS_NULL).length;
                //var countIsNotNull = myValues.filter((e: IHuemulFilterValues<any>) => e.operator === HuemulFilterOperators.IS_NOT_NULL).length;
                var countIn = myValues.filter((e: IHuemulFilterValues<any>) => e.operator === HuemulFilterOperators.IN).length;
                var countNotIn = myValues.filter((e: IHuemulFilterValues<any>) => e.operator === HuemulFilterOperators.NOT_IN).length;
                
                if ((countIn > 0 && countEquals > 0) || countEquals > 1) {
                    //transform equals to IN
                    for (const value of myValues.filter((e: IHuemulFilterValues<any>) => e.operator === HuemulFilterOperators.EQUALS)) {
                        value.operator = HuemulFilterOperators.IN; // Change EQUALS to IN
                    }
                }

                if ((countNotIn > 0 && countNotEquals > 0) || countNotEquals > 1) {
                    //transform not equals to NOT IN
                    for (const value of myValues.filter((e: IHuemulFilterValues<any>) => e.operator === HuemulFilterOperators.NOT_EQUALS)) {
                        value.operator = HuemulFilterOperators.NOT_IN; // Change NOT_EQUALS to NOT IN
                    }
                }


                let tableAlias = myFilter.tableAlias ?? this.aliasBase;
                let columnAlias = myFilter.columnAlias ?? columnName;

                // if multiple IN or EQUALS found, join them to one IN
                var inValues = myValues.filter((e: IHuemulFilterValues<any>) => e.operator === HuemulFilterOperators.IN);
                if (inValues.length >= 1) {
                    whereColumnIn = this._createInOrNotInSql(tableAlias, columnName, columnAlias, HuemulFilterOperators.IN, inValues, myFilter.huemulColumnClass === HuemulColumnClass.NORMAL);

                    // Remove the IN values from the original filter values
                    myValues = myValues.filter((e: IHuemulFilterValues<any>) => e.operator !== HuemulFilterOperators.IN);
                }

                // if multiple NOT IN or EQUALS found, join them to one NOT IN
                var notInValues = myValues.filter((e: IHuemulFilterValues<any>) => e.operator === HuemulFilterOperators.NOT_IN);
                if (notInValues.length >= 1) {
                    wherecolumnNotIn = this._createInOrNotInSql(tableAlias, columnName, columnAlias, HuemulFilterOperators.NOT_IN, notInValues, myFilter.huemulColumnClass === HuemulColumnClass.NORMAL);

                    // Remove the NOT IN values from the original filter values
                    myValues = myValues.filter((e: IHuemulFilterValues<any>) => e.operator !== HuemulFilterOperators.NOT_IN);
                }
                
                whereColumn = myValues.map((filterLine: IHuemulFilterValues<any>, index: number) => {
                    if (filterLine.operator === HuemulFilterOperators.IS_NULL) {
                        return `${isEmpty(tableAlias) ? "" : `"${tableAlias}".`}"${columnAlias}" is null`;
                    } else if (filterLine.operator === HuemulFilterOperators.IS_NOT_NULL) {
                        return `${isEmpty(tableAlias) ? "" : `"${tableAlias}".`}"${columnAlias}" is not null`;
                    } else {
                        let myValue = '';
                        let convertToUpperCase = false; // Convert to uppercase for LIKE and EQUALS operators
                        if (this.isString(filterLine.value)) {
                            myValue = `${filterLine.value}`;
                            if (myFilter.huemulColumnClass === HuemulColumnClass.NORMAL || filterLine.toUpper == true
                                || filterLine.operator === HuemulFilterOperators.LIKE) {
                                //convert to upper (LIKE is always case-insensitive, even for PK/FK columns)
                                myValue = myValue.toUpperCase();
                                convertToUpperCase = true;
                            }

                            if (filterLine.operator === HuemulFilterOperators.LIKE) {
                                myValue = `'%${sanitizeSqlText(myValue)}%'`; // For LIKE, we use wildcards
                            } else {
                                myValue = `'${sanitizeSqlText(myValue)}'`;
                            }
                        } else if (this.isBoolean(filterLine.value)) {
                            myValue = filterLine.value ? 'true' : 'false';
                        } else if (this.isNumber(filterLine.value)) {
                            myValue = filterLine.value.toString();
                        } else {
                            throw new Error(`Unsupported value type for column ${columnName} ${isEmpty(columnAlias) ? "" : `(alias: ${columnAlias})` }: ${typeof filterLine.value}`);
                        }

                        var sqlSentence = this._createSentence(tableAlias, columnAlias, filterLine.operator, myValue,  convertToUpperCase);

                        //return `${index === 0 ? '' : `${filterLine.connectiveWithPrevious ?? ' AND '}`} ${sqlSentence}`;
                        return `${index === 0 ? '' : ' AND '} ${sqlSentence}`;
                    }
                }).join(' ');

                //ADD IN
                if (hasValue(whereColumnIn)) {
                    if (isEmpty(whereColumn)) {
                        whereColumn = whereColumnIn; // If no other conditions, use the IN condition
                    } else {
                        whereColumn = `${whereColumnIn} AND ${whereColumn}`; // Combine with existing conditions
                    }
                }

                //ADD NOT IN
                if (hasValue(wherecolumnNotIn)) {
                    if (isEmpty(whereColumn)) {
                        whereColumn = wherecolumnNotIn; // If no other conditions, use the NOT IN condition
                    } else {
                        whereColumn = `${wherecolumnNotIn} AND ${whereColumn}`; // Combine with existing conditions
                    }
                }

                if (isEmpty(whereColumn)) {
                    continue; // No valid where clause for this column
                }

                if (myFilter.exclude) {
                    whereColumn = `NOT (${whereColumn})`;
                }

                whereColumn = `(${whereColumn})`;
                whereClauses.push(whereColumn);
            }

            if (whereClauses.length === 0) {
                continue; // No valid where clauses for this group
            }

            let whereTemp: string = whereClauses.join(` AND `);

            if (group.groupIndex === 0) {
                whereFinal = `(\n${whereTemp}\n)`;
            } else {
                // If this is not the first group, we need to add the connector
                whereFinal = `${whereFinal} \n ${group.connectorWithPrevious} \n (${whereTemp})`;
            }
        }

        if (isEmpty(whereFinal)) {
            return "";
        }

        const sqlFinal =  `${includeType === SqlWhereConnector.INCLUDE_WHERE
            ? "where "
            : includeType === SqlWhereConnector.INCLUDE_AND
            ? " and "
            : ""}${whereFinal}`;

        return sqlFinal;
    }

    /**
     * Add a filter for a specific column with a value
     * @param columnName - The name of the column to filter
     * @param value - The value to filter by, must not be empty
     */
    /*
    addFilter(columnName: string, value: IHuemulFilterValues) {
        if (isEmpty(value) || isEmpty(value.value)) {
            return;
        }

        // Check if the filter already exists
        const existingFilter = this.whereList.find(filter => filter.columnName === columnName);
        if (existingFilter) {
            // If it exists, add the new value to the existing filter
            existingFilter.values.push(value);
            return;
        }
        // If it doesn't exist, create a new filter
        const filter: IHuemulFilter = {
            columnName: columnName,
            values: [value],
        };
        this.whereList.push(filter);
    }
    */


    operatorStrToHuemul(operator: string): HuemulFilterOperators {
        if (operator.toUpperCase() === "EQ") {
            return HuemulFilterOperators.EQUALS;
        } else if (operator.toUpperCase() === "NEQ") {
            return HuemulFilterOperators.NOT_EQUALS;
        } else if (operator.toUpperCase() === "GT") {
            return HuemulFilterOperators.GREATER_THAN;
        } else if (operator.toUpperCase() === "GTE") {
            return HuemulFilterOperators.GREATER_THAN_OR_EQUAL;
        } else if (operator.toUpperCase() === "LT") {
            return HuemulFilterOperators.LESS_THAN;
        } else if (operator.toUpperCase() === "LTE") {
            return HuemulFilterOperators.LESS_THAN_OR_EQUAL;
        } else if (operator.toUpperCase() === "LIKE") {
            return HuemulFilterOperators.LIKE;
        } else if (operator.toUpperCase() === "IN") {
            return HuemulFilterOperators.IN;
        } else if (operator.toUpperCase() === "NIN") {
            return HuemulFilterOperators.NOT_IN;
        } else if (operator.toUpperCase() === "NULL") {
            return HuemulFilterOperators.IS_NULL;
        } else if (operator.toUpperCase() === "NNULL") {
            return HuemulFilterOperators.IS_NOT_NULL;
        } else {
            throw new Error(`Unknown operator: ${operator}`);
        }
    }

    /**
    * Add a filter to the current filters based on another filter's values
    * @param filter - The filter from which to copy values
    * @param clearPrevious - Whether to clear existing values before adding new ones (default: true)
    */
    addSortFromHeader(request: any): void {
        const sortByHeader = request.header("X-Sort-By");
        if (isEmpty(sortByHeader) || typeof sortByHeader !== "string") {
            return;
        }

        const sortColumns = sortByHeader!.split(",").map(s => s.trim());
        let sortPosition = 1;
        for (const sortColumn of sortColumns) {
            const [columnName, sortOrder] = sortColumn.split(":");
            const myFilter = this.getPropertyByName(columnName);
            if (myFilter !== undefined) {
                myFilter.sortPosition = sortPosition++;
                myFilter.sortAscending = sortOrder?.toUpperCase() !== "DESC";
            }
        }
    }

    /**
     * Get custom sort configuration for Knex based on the filters' sort settings
     * @returns An array of objects containing columnName and ascending properties for sorting
     */
    getCustomSortForKNex(defaultSort?: {column: string, order: string}[]): {column: string, order: string}[] {
        const columnList = this.getMyColumnNames();
        const sortConfig: {column: string, order: string, position: number}[] = [];
        for (const columnName of columnList) {
            const myFilter = this.getPropertyByName(columnName);
            if (myFilter !== undefined && myFilter.sortPosition !== undefined) {
                sortConfig.push({
                    column: columnName,
                    order: myFilter.sortAscending ?? true ? "asc" : "desc",
                    position: myFilter.sortPosition ?? Number.MAX_SAFE_INTEGER
                });
            }   
        }

        if (sortConfig.length === 0) {
            return defaultSort ?? [];
        }

        // Sort the config by sortPosition
        sortConfig.sort((a, b) => a.position - b.position);

        //add at last position the PK, to force to return always the same record first if there are duplicates in the sort columns
        const pkFilter = this.getPrimaryKeyFilter();
        if (pkFilter !== undefined && pkFilter.columnName !== undefined) {
            sortConfig.push({
                column: pkFilter.columnName!,
                order: "asc",
                position: Number.MAX_SAFE_INTEGER
            });
        }

        // Return only columnName and ascending
        return sortConfig.map(c => ({column: c.column, order: c.order}));
    }

    /**
     * Get the primary key filter from the current filters
     * @returns The primary key filter if found, otherwise undefined
     */
    getPrimaryKeyFilter(): {columnName: string | undefined, filter: HuemulFilterBase<any> | undefined} {
        const columnList = this.getMyColumnNames();
        for (const columnName of columnList) {
            const myFilter = this.getPropertyByName(columnName);
            
            if (myFilter !== undefined && myFilter.huemulColumnClass === HuemulColumnClass.PK) {
                return {
                    columnName: columnName,
                    filter: myFilter
                };
            }
        }
        return {columnName: undefined, filter: undefined};
    }

    /**
     * Add a filter from express query columns
     * @param query. request.query object
     * @returns void
     */
    addFilterFromQuery(query: any, queryNameForExclude: string = "exclude") {
        //this.whereList = [];

        if (isEmpty(query)) {
            return;
        }

        let exclude = isEmpty(queryNameForExclude) ? '' : `,${query[queryNameForExclude]},`;
        exclude = exclude.toUpperCase();

        for (const queryName in query) {
            if (!Object.hasOwn(query, queryName)) {
                return;
            }

            const value = query[queryName];
            let operator: HuemulFilterOperators = HuemulFilterOperators.EQUALS;
            let columName = queryName;



            //split columnName __ operator
            const parts = queryName.split("__");
            // If the columnName has an operator, use it; otherwise, default to EQUAL
            
            if (parts.length === 2) {
                // The last part is the operator
                const lastPart = parts[1]?.toUpperCase();
                operator = this.operatorStrToHuemul(lastPart ?? "EQ");

                // The rest is the column name
                columName = parts[0];
            }

            let myFilter: HuemulFilterBase<any> | undefined = this.getPropertyByName(columName);
            if (myFilter !== undefined) {
                myFilter.exclude = exclude.includes(`,${columName.toUpperCase()},`);
                const myType = myFilter.getType();

                //value is list?
                if (Array.isArray(value)) {
                    for (const item of value) {
                        const newValue = myType == Number ? parseFloat(item) :
                                     myType == Boolean ? toBoolean(item) :
                                     myType == String ? item : item;

                        myFilter.addFilter(newValue, operator);
                    }
                } else {
                    const newValue = myType == Number ? parseFloat(value) :
                                     myType == Boolean ? toBoolean(value) :
                                     myType == String ? value : value;

                    myFilter.addFilter(newValue, operator);
                }
                
                /*
                myValues.push({
                    operator: operator, 
                    value: newValue,
                    //connectiveWithPrevious: "AND", // Default connective, can be changed later
                    whereGroup: 0 // Default whereGroup, can be changed later
                });*/
            }
        }

        //for each column, change 2 or more equals to one IN
        const columnList = this.getMyColumnNames();
        for (const columnName of columnList) {
            const myFilter = this.getPropertyByName(columnName);
            if (myFilter === undefined || !this.isValidFilter(myFilter)) {
                continue; // Skip if not a valid filter
            }

            // If there are multiple EQUALS, convert them to IN
            const equalsValues = myFilter.values.filter((v: IHuemulFilterValues<any>) => v.operator === HuemulFilterOperators.EQUALS);
            if (equalsValues.length > 1) {
                myFilter.values = myFilter.values.filter((v: IHuemulFilterValues<any>) => v.operator !== HuemulFilterOperators.EQUALS); // Remove EQUALS
                myFilter.addAllFilters(equalsValues.map((v: IHuemulFilterValues<any>) => v.value), HuemulFilterOperators.IN);
            }
        }
    }

    sqlInjectionCheck(): {column: string, message: string}[] {
        const columnList = this.getMyColumnNames();
        const errors: {column: string, message: string}[] = [];
        for (const columnName of columnList) {
            const myFilter = this.getPropertyByName(columnName);
            if (myFilter === undefined || !this.isValidFilter(myFilter)) {
                continue; // Skip if not a valid filter
            }

            for (const value of myFilter.values) {
                if (!sqlInjectionValidation(value.value)) {
                    errors.push({
                        column: columnName,
                        message: `SQL Injection detected in value: ${value.value} for column: ${columnName}`
                    });
                }
            }
        }

        return errors;
    }


}

export enum HuemulFilterComparison {
    EQUAL = "=",
    GREATER_THAN = ">",
    GREATER_THAN_OR_EQUAL = ">=",
    LESS_THAN = "<",
    LESS_THAN_OR_EQUAL = "<=",
}