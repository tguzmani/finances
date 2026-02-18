We need to implement a /group flow. For this group use that very command to begin grouping. We will be using the the edit strategy (each step in the flow will update the message and do not create new ones [store this under a .claude/skills/edit-telegram-message-skill.md])

This is how it works

Case 1: There are no groups
1. If there are no groups, tell the user if he wants to create a new group
2. List the transactions to add one. Transactions appear as buttons, have the name and amount in VES/USD depending on the currency
3. After adding the first tx, then let the user know if he wants to continue or stop there
4. Go to step 2 and repeat

Case 2: Tehre agre groups
1. List the groups available and also an option to add a new group

Case 2.1: User adds a new group => Proceed as Case 1.1 step

Case 2.2: User picks agroup from the list. => Proceed with Case 1.2 step in the flow
