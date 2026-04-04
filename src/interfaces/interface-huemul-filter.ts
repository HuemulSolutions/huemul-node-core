//enum operators
export enum HuemulFilterOperators {
    EQUALS = '=',
    NOT_EQUALS = '!=',
    GREATER_THAN = '>',
    LESS_THAN = '<',
    GREATER_THAN_OR_EQUAL = '>=',
    LESS_THAN_OR_EQUAL = '<=',
    LIKE = 'LIKE',
    IN = 'IN',
    NOT_IN = 'NOT IN',
    IS_NULL = 'IS NULL',
    IS_NOT_NULL = 'IS NOT NULL'
}

export enum HuemulColumnClass {
    NORMAL = 'normal',
    PK = 'pk',
    FK = 'fk',    
}

export abstract class HuemulFilterBase<T> {
    exclude?: boolean; // Optional flag to exclude this filter
    values: IHuemulFilterValues<T>[]; // Array of filter values with operators
    onlyDate?: boolean; // Optional flag to indicate if datetime use only date part
    onlyTime?: boolean; // Optional flag to indicate if datetime use only time part
    tableAlias?: string; // Optional table alias for the filter, in undefined, used the default
    columnAlias?: string; // Optional column alias for the filter, in undefined, used the default
    huemulColumnClass: HuemulColumnClass; // Class of the column (e.g., NORMAL, PK, FK)


    constructor(huemulColumnClass: HuemulColumnClass, onlyDate?: boolean, onlyTime?: boolean) {
        this.values = [];
        this.exclude = false;
        this.onlyDate = onlyDate;
        this.onlyTime = onlyTime;
        this.huemulColumnClass = huemulColumnClass;
    }

    getType(): any {
        return null; // Return null if _intValue is not set
    }

    checkValues(newOperator: HuemulFilterOperators): boolean {
        //only one >, <, >=, <=, =, !=
        const operators = [HuemulFilterOperators.GREATER_THAN, HuemulFilterOperators.LESS_THAN, 
            HuemulFilterOperators.GREATER_THAN_OR_EQUAL, HuemulFilterOperators.LESS_THAN_OR_EQUAL,
            //HuemulFilterOperators.EQUALS, HuemulFilterOperators.NOT_EQUALS -->EXCLUDED BECAUSE THEY ARE JOINT TO "IN"
        ];

        const hasOperator = this.values.some(v => v.operator == newOperator);
        if (hasOperator && operators.includes(newOperator)) {
            // If there is already a comparison operator, do not add another one
            console.error(`Cannot add multiple comparison operators (${newOperator}) in the same filter.`);
            return false;
        }

        // Check for IS NULL or IS NOT NULL
        if (newOperator === HuemulFilterOperators.IS_NULL || newOperator === HuemulFilterOperators.IS_NOT_NULL) {
            const hasNullCheck = this.values.some(v => 
                v.operator === HuemulFilterOperators.IS_NULL || v.operator === HuemulFilterOperators.IS_NOT_NULL);
            if (hasNullCheck) {
                // If there is already a null check, do not add another one
                console.error(`Cannot add multiple null checks (${newOperator}) in the same filter.`);
                return false;
            }
        }

        // If no conflicting operators, return true to allow adding the new operator
        return true;
    }

    addFromFilter(filter: HuemulFilterBase<T>, clearPrevious: boolean = true): void {
        if (clearPrevious) {
            this.clearValues(); // Clear previous values if specified
        }

        this.exclude = filter.exclude; // Copy exclude flag
        this.onlyDate = filter.onlyDate; // Copy onlyDate flag
        this.onlyTime = filter.onlyTime; // Copy onlyTime flag


        if (filter && filter.values && filter.values.length > 0) {
            for (const value of filter.values) {
                this.addFilter(value.value, value.operator, value.whereGroup, value.toUpper);
            }
        } else {
            console.warn('No values to add from the provided filter.');
        }
    }


    addFilter(value: T, operator: HuemulFilterOperators, whereGroup: number = 0, toUpper?: boolean ): void {
        if (!this.checkValues(operator)) {
            // If the operator is not valid, do not add the filter
            console.error(`Invalid operator (${operator}) for the current filter state.`);
            return;
        }

        this.values.push({
            operator: operator,
            value: value,
            whereGroup: whereGroup,
            toUpper: toUpper
        });
    }

    addNull(whereGroup: number = 0): void {
        if (!this.checkValues(HuemulFilterOperators.IS_NULL)) {
            // If the operator is not valid, do not add the filter
            console.error(`Invalid operator (IS NULL) for the current filter state.`);
            return;
        }
        
        this.values.push({
            operator: HuemulFilterOperators.IS_NULL,
            value: null as any, // Use 'any' to allow null value
            whereGroup: whereGroup
        });
    }

    addNotNull(whereGroup: number = 0): void {
        if (!this.checkValues(HuemulFilterOperators.IS_NOT_NULL)) {
            // If the operator is not valid, do not add the filter
            console.error(`Invalid operator (IS NOT NULL) for the current filter state.`);
            return;
        }

        this.values.push({
            operator: HuemulFilterOperators.IS_NOT_NULL,
            value: null as any, // Use 'any' to allow null value
            whereGroup: whereGroup
        });
    }

    addAllFilters(values: T[], operator: HuemulFilterOperators, whereGroup: number = 0): void {
        for (const value of values) {
            this.addFilter(value, operator, whereGroup);
        }
    }

    hasAnyValue(): boolean {
        return this.values.length > 0;
    }

    isEmpty(): boolean {
        return this.values.length === 0;
    }

    getValue(whereGroup: number = 0, index: number = 0): T | undefined {
        const filteredValues = this.values.filter(v => v.whereGroup === whereGroup);
        if (filteredValues.length > index) {
            return filteredValues[index].value;
        }
        return undefined; // Return null if no value found for the specified group and index
    }

    getValues(): T[] {
        return this.values.map(v => v.value);
    }

    clearValues(): void {
        this.values = [];
    }

    sortPosition?: number; // Optional property to define the sort position of the filter
    sortAscending?: boolean; // Optional property to define if the sorting is ascending or descending
}

export class HuemulFilterString extends HuemulFilterBase<string> {
    constructor(huemulColumnClass: HuemulColumnClass) {
        super(huemulColumnClass);
    }

    addFilter(value: string, operator: HuemulFilterOperators, whereGroup: number = 0, toUpper?: boolean): void {
        super.addFilter(value as string, operator, whereGroup, toUpper);
    }

    addAllFilters(values: string[], operator: HuemulFilterOperators, whereGroup?: number): void {
        super.addAllFilters(values, operator, whereGroup);
    }

    getType() {
        return String; // Return String type for string filters
    }
}

export class HuemulFilterDate extends HuemulFilterBase<string> {
    constructor(huemulColumnClass: HuemulColumnClass, onlyDate?: boolean, onlyTime?: boolean) {
        super(huemulColumnClass, onlyDate, onlyTime);
    }

    addFilter(value: string, operator: HuemulFilterOperators, whereGroup: number = 0): void {
        super.addFilter(value as string, operator, whereGroup);
    }

    addAllFilters(values: string[], operator: HuemulFilterOperators, whereGroup?: number): void {
        super.addAllFilters(values, operator, whereGroup);
    }

    getType() {
        return String; // Return String type for date filters
    }
}

export class HuemulFilterNumber extends HuemulFilterBase<number> {
    constructor(huemulColumnClass: HuemulColumnClass) {
        super(huemulColumnClass);
    }
    addFilter(value: number, operator: HuemulFilterOperators, whereGroup: number = 0): void {
        super.addFilter(value as number, operator, whereGroup);
    }

    addAllFilters(values: number[], operator: HuemulFilterOperators, whereGroup?: number): void {
        super.addAllFilters(values, operator, whereGroup);
    }

    getType() {
        return Number; // Return Number type for number filters
    }
}

export class HuemulFilterBoolean extends HuemulFilterBase<boolean> {
    constructor(huemulColumnClass: HuemulColumnClass) {
        super(huemulColumnClass);
    }

    addFilter(value: boolean, operator: HuemulFilterOperators, whereGroup: number = 0): void {
        super.addFilter(value as boolean, operator, whereGroup);
    }

    addAllFilters(values: boolean[], operator: HuemulFilterOperators, whereGroup?: number): void {
        super.addAllFilters(values, operator, whereGroup);
    }

    getType() {
        return Boolean; // Return Boolean type for boolean filters
    }

}

/*
export interface IHuemulFilter<T> extends HuemulFilterBase<T> {
    columnName: string; // Column name to apply the filter on
}
*/


export interface IHuemulFilterValues<T> {
    operator: HuemulFilterOperators; // Operator for the filter (e.g., '=', '>', '<', 'LIKE', etc.)
    value: T; // Value to compare against the column
    //connectiveWithPrevious?: 'AND' | 'OR'; // Optional connective for combining multiple values
    whereGroup: number;
    toUpper?: boolean; // Optional flag to indicate if the value should be converted to uppercase
}