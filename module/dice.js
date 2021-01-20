/**
 * A standardized helper function for managing Cthulhu Hack dice rolls
 *
 * @param {String} diceType             The type of dice : d20, d12, d10, d8, d6, d4
 * @param {String} customFormula        Custom Formula
 * @param {Array} parts                 The dice roll component parts, excluding the initial dice
 * @param {Object} data                 Actor or item data against which to parse the roll
 * @param {Event|object} event          The triggering event which initiated the roll
 * @param {string} rollMode             A specific roll mode to apply as the default for the resulting roll
 * @param {string|null} template        The HTML template used to render the roll dialog
 * @param {string|null} title           The dice roll UI window title
 * @param {Object} speaker              The ChatMessage speaker to pass when creating the chat
 * @param {string|null} flavor          Flavor text to use in the posted chat message
 * @param {Function} onClose            Callback for actions to take when the dialog form is closed
 * @param {Object} dialogOptions        Modal dialog options
 * @param {boolean} advantage           Apply advantage to the roll (unless otherwise specified)
 * @param {boolean} disadvantage        Apply disadvantage to the roll (unless otherwise specified)
 * @param {boolean} rollType            Specify the type of roll : Save, Resource, Damage, Material, AttackDamage
 * @param {number} targetValue          Assign a target value against which the result of this roll should be compared
 * @param {boolean} chatMessage         Automatically create a Chat Message for the result of this roll
 * @param {number} modifier             Bonus (+X) or malus (-X) for the roll
 * @param {object} messageData          Additional data which is applied to the created Chat Message, if any
 * @param {object} abilitiesAdvantages  Advantages gained from abilities
 *
 * @return {Promise}                    A Promise which resolves once the roll workflow has completed
 */
export async function diceRoll(
	{
		diceType = 'd20',
		customFormula = null,
		parts = [],
		data = {},
		event = {},
		rollMode = null,
		template = null,
		title = null,
		speaker = null,
		flavor = null,
		dialogOptions,
		advantage = null,
		disadvantage = null,
		rollType = null,
		targetValue = null,
		chatMessage = true,
		modifier = null,
		abilitiesAdvantages = null,
		messageData = {}
	} = {}
) {
	// Prepare Message Data
	messageData.flavor = flavor || title;
	messageData.speaker = speaker || ChatMessage.getSpeaker();
	const messageOptions = { rollMode: rollMode || game.settings.get('core', 'rollMode') };
	if (rollType === 'Save') {
		parts = parts.concat([ '@modifier' ]);
	}

	let adv = 0;

	// Define the inner roll function
	const _roll = (parts, adv, form, advantage, disadvantage) => {
		// Determine the dice roll and modifiers
		let nd = 1;
		let mods = '';

		// Handle advantage choice
		if (adv === 1) {
			nd++;
			// Custom advantage or disadvantage
			if (advantage) {
				nd++;
				messageData.flavor += ` (${game.i18n.localize('CTHACK.ConditionAdvantage')})`;
			} else if (disadvantage) {
				nd--;
				messageData.flavor += ` (${game.i18n.localize('CTHACK.ConditionDisadvantage')})`;
			}
			messageData.flavor += ` (${game.i18n.localize('CTHACK.Advantage')})`;
			if (rollType === 'Resource') {
				mods += 'kh';
			} else mods += 'kl';
		} else if (adv === -1) {
			// Handle disadvantage choice
			nd++;
			// Custom advantage or disadvantage
			if (advantage) {
				nd--;
				nd--;
				Désava;
				messageData.flavor += ` (${game.i18n.localize('CTHACK.ConditionAdvantage')})`;
			} else if (disadvantage) {
				nd++;
				messageData.flavor += ` (${game.i18n.localize('CTHACK.ConditionDisadvantage')})`;
			}
			messageData.flavor += ` (${game.i18n.localize('CTHACK.Disadvantage')})`;
			if (rollType === 'Resource') {
				mods += 'kl';
			} else mods += 'kh';
		} else if (adv === 0) {
			// Handle normal choice
			// Custom advantage or disadvantage
			if (advantage) {
				nd++;
				messageData.flavor += ` (${game.i18n.localize('CTHACK.ConditionAdvantage')})`;
				if (rollType === 'Resource') {
					mods += 'kh';
				} else mods += 'kl';
			} else if (disadvantage) {
				nd++;
				messageData.flavor += ` (${game.i18n.localize('CTHACK.ConditionDisadvantage')})`;
				if (rollType === 'Resource') {
					mods += 'kl';
				} else mods += 'kh';
			}
		}

		// Prepend the dice roll
		let formula = `${nd}${diceType}${mods}`;

		if (customFormula !== null) {
			parts.unshift(customFormula);
		} else {
			parts.unshift(formula);
		}

		// Optionally include a situational bonus
		if (rollType === 'Save' && form) {
			data['modifier'] = -1 * form.modifier.value;
			modifier = form.modifier.value;
			messageOptions.rollMode = form.rollMode.value;
		}
		// Remove the @modifier if there is no modifier
		if (rollType === 'Save' && !data['modifier']) parts.pop();

		// Execute the roll
		let roll = new Roll(parts.join(' + '), data);
		try {
			roll.roll();
		} catch (err) {
			console.error(err);
			ui.notifications.error(`Dice roll evaluation failed: ${err.message}`);
			return null;
		}

		return roll;
	};

	// Create the Roll instance
	const roll = await _diceRollDialog({
		template,
		title,
		parts,
		data,
		rollMode: messageOptions.rollMode,
		dialogOptions,
		rollType,
		modifier,
		advantage,
		disadvantage,
		abilitiesAdvantages,
		roll: _roll
	});

	// Create a Chat Message
	if (roll && chatMessage) {
		if (modifier !== null && modifier > 0) {
			messageData.flavor += `${game.i18n.format('CTHACK.RollWithBonus', { modifier: modifier })}`;
		}
		if (modifier !== null && modifier < 0) {
			messageData.flavor += `${game.i18n.format('CTHACK.RollWithMalus', { modifier: modifier })}`;
		}
		// Save roll
		if (rollType === 'Save' && targetValue) {
			if (roll.total < targetValue) {
				messageData.flavor += `<br><b>${game.i18n.localize('CTHACK.RollSuccess')}</b>`;
			} else {
				messageData.flavor += `<br><b>${game.i18n.localize('CTHACK.RollFailure')}</b>`;
			}
		} else if (rollType === 'Resource') {
			// Resource roll
			if (roll.total == 1 || roll.total == 2) {
				messageData.flavor += `<br><b>${game.i18n.localize('CTHACK.ResourceRollFailure')}</b>`;
			}
		}
		roll.toMessage(messageData, messageOptions);
	}

	return roll;
}

/**
 * Present a Dialog form which creates a roll once submitted
 * @return {Promise<Roll>}
 * @private
 */
async function _diceRollDialog({ template, title, parts, data, rollMode, dialogOptions, rollType, modifier, advantage, disadvantage, abilitiesAdvantages, roll } = {}) {
	// Render modal dialog
	template = template || 'systems/cthack/templates/chat/roll-dialog.html';
	let dialogData = {
		formula: parts.join(' + '),
		data: data,
		rollMode: rollMode,
		rollModes: CONFIG.Dice.rollModes,
		rollType: rollType,
		modifier: modifier,
		advantage: advantage,
		disadvantage: disadvantage,
		abilitiesAdvantages: abilitiesAdvantages
	};
	const html = await renderTemplate(template, dialogData);

	if (rollType !== 'AttackDamage') {
		// Create the Dialog window
		return new Promise((resolve) => {
			new Dialog(
				{
					title: title,
					content: html,
					buttons: {
						advantageBtn: {
							label: game.i18n.localize('CTHACK.Advantage'),
							callback: (html) => resolve(roll(parts, 1, html[0].querySelector('form'), advantage, disadvantage))
						},
						normalBtn: {
							label: game.i18n.localize('CTHACK.Normal'),
							callback: (html) => resolve(roll(parts, 0, html[0].querySelector('form'), advantage, disadvantage))
						},
						disadvantageBtn: {
							label: game.i18n.localize('CTHACK.Disadvantage'),
							callback: (html) => resolve(roll(parts, -1, html[0].querySelector('form'), advantage, disadvantage))
						}
					},
					default: 'normalBtn',
					close: () => resolve(null)
				},
				dialogOptions
			).render(true);
		});
	} else {
		// Create the Dialog window
		return new Promise((resolve) => {
			new Dialog(
				{
					title: title,
					content: html,
					buttons: {
						normalBtn: {
							label: game.i18n.localize('CTHACK.Normal'),
							callback: (html) => resolve(roll(parts, 0, html[0].querySelector('form'), advantage, disadvantage))
						}
					},
					default: 'normalBtn',
					close: () => resolve(null)
				},
				dialogOptions
			).render(true);
		});
	}
}
