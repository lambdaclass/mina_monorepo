import { expect, type Locator, type Page } from '@playwright/test';

export class OnChainStateMgmtZkAppPage {
  readonly page: Page;
  readonly deployButton: Locator;
  readonly updateButton: Locator;
  readonly clearEventsButton: Locator;
  readonly zkAppStateValue: Locator;
  readonly eventsContainer: Locator;
  readonly zkAppStateContainer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.deployButton = page.locator('button[id="deployButton"]');
    this.updateButton = page.locator('button[id="updateButton"]');
    this.clearEventsButton = page.locator('button[id="clearEventsButton"]');
    this.zkAppStateValue = page.locator('input[id="zkAppStateValue"]');
    this.eventsContainer = page.locator('span[id="eventsContainer"]');
    this.zkAppStateContainer = page.locator('span[id="zkAppStateContainer"]');
  }

  async goto() {
    await this.page.goto('/on-chain-state-mgmt-zkapp-ui.html');
  }

  async compileAndDeployZkApp() {
    await this.deployButton.click();
  }

  async updateZkAppState(value: string) {
    await this.zkAppStateValue.fill(value);
    await this.updateButton.click();
  }

  async clearEvents() {
    await this.clearEventsButton.click();
  }

  async checkSnarkyJsInitialization() {
    await expect(this.eventsContainer).toContainText(
      'SnarkyJS initialized after'
    );
  }

  async checkDeployedZkApp() {
    await expect(this.eventsContainer).toContainText('Deploying zkApp');
    await expect(this.eventsContainer).toContainText('Initial zkApp State: 2');
    await expect(this.eventsContainer).toContainText(
      'zkApp Deployed successfully!'
    );
    await expect(this.zkAppStateContainer).toHaveText('2');
  }

  async checkUpdatedZkAppState(currentValue: string, nextValue: string) {
    await expect(this.eventsContainer).toContainText(
      `Updating zkApp State from ${currentValue} to ${nextValue}`
    );
    await expect(this.eventsContainer).toContainText(
      `zkApp State successfully updated to: ${nextValue}!`
    );
    await expect(this.zkAppStateContainer).toHaveText(nextValue);
  }

  async checkZkAppDeploymentFailureByFeeExcess() {
    await expect(this.eventsContainer).toContainText('Deploying zkApp');
    await expect(this.eventsContainer).toContainText(
      'zkApp Deployment failure'
    );
    await expect(this.eventsContainer).toContainText('Invalid_fee_excess');
  }

  async checkZkAppStateUpdateFailureByUnknownAccount() {
    await expect(this.eventsContainer).toContainText(
      'zkApp State Update failure'
    );
    await expect(this.eventsContainer).toContainText(
      'Could not find account for public key'
    );
    await expect(this.zkAppStateContainer).toHaveText('No data available yet.');
  }

  async checkZkAppStateUpdateFailureByStateConstraint(
    actualValue: string,
    nextValue: string,
    expectedValue: string
  ) {
    await expect(this.eventsContainer).toContainText(
      `Updating zkApp State from ${actualValue} to ${expectedValue}`
    );
    await expect(this.eventsContainer).toContainText(
      `zkApp State Update failure: Field.assertEquals(): ${nextValue} != ${expectedValue}`
    );
    await expect(this.zkAppStateContainer).toHaveText(actualValue);
  }
}
