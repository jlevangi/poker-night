import math

def calculate_chip_distribution(total_buy_in):
    """
    Calculates a weighted breakdown of poker chips for a given buy-in.

    This function takes a total buy-in value and determines the number of
    chips of each denomination required, based on a predefined weighted
    distribution that favors lower-value chips.

    Args:
        total_buy_in (float): The total monetary value of the buy-in.

    Returns:
        dict: A dictionary where keys are chip colors (str) and values are
              the number of chips of that color (int). Returns None if the
              buy-in is not a positive number.
    """
    if total_buy_in <= 0:
        print("Error: Total buy-in must be a positive number.")
        return None

    # Define the chip values and the desired weights for distribution
    chip_definitions = [
        ("Black", 1.00, 10),
        ("Blue", 0.50, 10),
        ("Green", 0.20, 13),
        ("Red", 0.10, 14),
        ("White", 0.05, 20)
    ]
    # Create a simple list of tuples for the greedy remainder calculation
    chip_values_desc = [(name, val) for name, val, _ in chip_definitions]


    # --- New Algorithm for Weighted Stacks ---
    # To avoid floating point errors, we will work with cents.
    total_cents = int(round(total_buy_in * 100))
    
    # Calculate the total value of one "full weighted set" of chips in cents
    value_of_weighted_set = sum(int(value * 100) * weight for _, value, weight in chip_definitions)

    if value_of_weighted_set == 0:
        print("Error: Chip values or weights cannot result in a zero-value set.")
        return None

    # Determine how many full weighted sets fit into the total buy-in
    num_sets = total_cents // value_of_weighted_set
    
    # Calculate the base distribution from the full sets
    chip_distribution = {name: num_sets * weight for name, _, weight in chip_definitions}

    # Calculate the remaining value after distributing the base sets
    remaining_cents = total_cents % value_of_weighted_set

    # Distribute the remainder greedily (using largest chips first)
    # to add on top of the base stacks.
    for chip_name, chip_value in chip_values_desc:
        chip_value_cents = int(chip_value * 100)
        if remaining_cents >= chip_value_cents:
            additional_chips = remaining_cents // chip_value_cents
            chip_distribution[chip_name] += additional_chips
            remaining_cents -= additional_chips * chip_value_cents

    print(f"\nCalculating weighted chip distribution for a buy-in of ${total_buy_in:.2f}...")
    
    return chip_distribution


def display_distribution(distribution):
    """Prints the chip distribution in a user-friendly format."""
    if not distribution:
        return

    print("\n--- Chip Breakdown ---")
    total_chips = 0
    calculated_total_value = 0.0
    chip_value_map = {"Black": 1.00, "Blue": 0.50, "Green": 0.20, "Red": 0.10, "White": 0.05}

    for chip, count in sorted(distribution.items(), key=lambda item: chip_value_map[item[0]], reverse=True):
        if count > 0:
            print(f"{chip:<6}: {count} chip(s)")
            total_chips += count
            calculated_total_value += count * chip_value_map[chip]

    print("----------------------")
    print(f"Total number of chips: {total_chips}")
    print(f"Total calculated value: ${calculated_total_value:.2f}")
    print("----------------------\n")


if __name__ == "__main__":
    try:
        # Get user input for the total buy-in
        buy_in_input = float(input("Enter the total buy-in amount (e.g., 20.00): "))

        # Calculate the distribution
        final_distribution = calculate_chip_distribution(buy_in_input)

        # Display the result
        if final_distribution:
            display_distribution(final_distribution)

    except ValueError:
        print("\nInvalid input. Please enter a valid number (e.g., 20.00 or 25.50).")
    except Exception as e:
        print(f"\nAn unexpected error occurred: {e}")
