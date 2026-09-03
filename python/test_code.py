class Calculator:
    def divide(self, a, b):
        if b == 0:
            raise ValueError("Cannot divide by zero")

        return a / b


def calculate_total(items):
    total = 0

    for item in items:
        if item > 0:
            total += item

    return total


calculator = Calculator()

print(calculator.divide(10, 2))
print(calculate_total([10, 20, 30]))