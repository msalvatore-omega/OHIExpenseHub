import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectLabel, SelectItem } from 'ohi-expense-hub';

export function WithGroups() {
  return (
    <div style={{ padding: '16px', maxWidth: '240px' }}>
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Expense category" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Travel</SelectLabel>
            <SelectItem value="flight">Flight</SelectItem>
            <SelectItem value="hotel">Hotel</SelectItem>
            <SelectItem value="transport">Ground Transport</SelectItem>
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Meals</SelectLabel>
            <SelectItem value="client-meal">Client Meal</SelectItem>
            <SelectItem value="team-lunch">Team Lunch</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
