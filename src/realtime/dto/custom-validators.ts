import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator'

export function IsRouletteBetValue(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            name: 'isRouletteBetValue',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
                validate(value: any, args: ValidationArguments) {
                    const { betType } = args.object as any
                    if (betType === 'single') {
                        return typeof value === 'number' && value >= 0 && value <= 36
                    }
                    const validValues = ['red', 'black', 'odd', 'even']
                    return typeof value === 'string' && validValues.includes(value)
                },
                defaultMessage(args: ValidationArguments) {
                    const { betType } = args.object as any
                    if (betType === 'single') {
                        return 'For single bet type, betValue must be a number between 0 and 36.'
                    }
                    return 'For red, black, odd, and even bet types, betValue must be one of the following strings: red, black, odd, even.'
                },
            },
        })
    }
}
