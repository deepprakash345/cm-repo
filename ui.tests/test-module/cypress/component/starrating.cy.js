/*
 * Copyright 2026 Adobe
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const component = '../../ui.apps/src/main/content/jcr_root/apps/rdepoc/components/adaptiveForm/starrating'
const block = 'cmp-adaptiveform-starrating'
const radio = '.' + block + '__radio'

describe('Star Rating with the real Forms Core Components runtime', () => {
    let view
    let model
    let form

    beforeEach(() => {
        const runtimePath = Cypress.env('FORMS_RUNTIME_JS')
        expect(runtimePath, 'FORMS_RUNTIME_JS must point to the published Forms runtime main.js').to.be.a('string')
        cy.readFile(runtimePath).as('runtime')
        cy.readFile(component + '/clientlibs/site/js/starratingview.js').as('source')
        cy.readFile(component + '/clientlibs/site/css/starrating.less').as('styles')
        cy.readFile(component + '/clientlibs/site/.content.xml')
            .should('contain', 'dependencies="[core.forms.components.runtime.all]"')
        const options = Array.from({length: 7}, (_, index) => `
            <label class="${block}__option">
                <input class="${block}__radio" type="radio" name="rating-radio" value="${index + 1}"
                    aria-label="${index + 1} of 7 stars">
                <svg class="${block}__star" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2L22 22H2Z"/></svg>
            </label>`).join('')
        cy.intercept('GET', 'http://starrating.invalid/', {
            headers: {'content-type': 'text/html'},
            body: `<html><body><button id="before">Before</button>
                <div id="rating" class="${block}" data-cmp-is="adaptiveFormStarRating">
                    <div class="${block}__label-container"><span id="rating__label">
                        <label class="${block}__label" for="rating-widget">Experience rating</label>
                    </span><button class="${block}__questionmark" aria-expanded="false" title="Help text"></button></div>
                    <input class="${block}__widget" id="rating-widget" type="number" hidden>
                    <div class="${block}__group" role="radiogroup">${options}</div>
                    <button class="${block}__clear" type="button">Clear rating</button>
                    <div class="${block}__shortdescription" aria-live="polite">Choose a rating</div>
                    <div class="${block}__longdescription" aria-live="polite"><p>Choose a rating</p></div>
                    <div class="${block}__errormessage" aria-live="assertive"></div>
                </div><button id="after">After</button></body></html>`
        })
        cy.visit('http://starrating.invalid/')
        cy.get('@runtime').then(runtime => {
            cy.get('@source').then(source => {
                cy.get('@styles').then(styles => {
                    cy.window().then(win => {
                        win.eval(runtime)
                        const style = win.document.createElement('style')
                        style.textContent = styles
                        win.document.head.appendChild(style)
                        let createView
                        const setupField = win.FormView.Utils.setupField
                        win.FormView.Utils.setupField = factory => { createView = factory }
                        win.eval(source)
                        win.FormView.Utils.setupField = setupField
                        win.guideBridge = {trigger: Cypress.sinon.spy()}
                        form = win.FormView.createFormInstance({
                            adaptiveform: '0.14.0',
                            items: [{
                                id: 'rating', name: 'experienceRating', fieldType: 'number-input',
                                type: 'integer', minimum: 1, maximum: 7, step: 1,
                                label: {value: 'Experience rating', visible: true},
                                description: 'Choose a rating', enabled: true, visible: true,
                                readOnly: false, required: false
                            }]
                        })
                        model = form.getElement('rating')
                        view = createView({
                            element: win.document.getElementById('rating'),
                            formContainer: {
                                getModel: () => form, getFormId: () => 'example',
                                getFormTitle: () => 'Rating example', getPath: () => '/example'
                            }
                        })
                        view.setModel(model)
                        view.subscribe()
                        view.syncMarkupWithModel()
                    })
                })
            })
        })
    })

    it('commits a numeric rating, fills preceding stars, and clears optional values', () => {
        cy.get(radio).eq(3).check({force: true})
        cy.then(() => { expect(model.value).to.equal(4) })
        cy.get('.' + block + '__option[data-filled="true"]').should('have.length', 4)
        cy.get('.' + block + '__clear').click()
        cy.get(radio + ':checked').should('not.exist')
        cy.then(() => { expect(model.value).to.equal(null) })
    })

    it('supports arrow wrapping, Home, End, Space, and Enter with focus indicators', () => {
        cy.get(radio).first().focus()
        cy.get(radio).first().trigger('keydown', {key: 'ArrowRight'})
        cy.get(radio).eq(1).should('be.focused').and('be.checked')
        cy.get(radio).eq(1).trigger('keydown', {key: 'Home'})
        cy.get(radio).first().trigger('keydown', {key: 'ArrowLeft'})
        cy.get(radio).last().should('be.focused').and('be.checked')
        cy.get(radio).last().trigger('keydown', {key: ' '})
        cy.get(radio).last().trigger('keydown', {key: 'Enter'})
        cy.get(radio).last().trigger('keydown', {key: 'Home'})
        cy.get(radio).first().trigger('keydown', {key: 'End'})
        cy.get(radio).last().next().should('have.css', 'outline-width', '2px')
        cy.then(() => { expect(model.value).to.equal(7) })
        cy.get('#after').focus()
        cy.get('#rating').should('have.attr', 'data-cmp-active', 'false')
    })

    it('rejects read-only mouse and keyboard changes without disabling focus', () => {
        cy.then(() => { model.value = 3; model.readOnly = true })
        cy.get(radio).eq(4).click({force: true})
        cy.get(radio).eq(4).focus()
        cy.get(radio).eq(4).trigger('keydown', {key: 'ArrowRight'})
        cy.get(radio).eq(2).should('be.checked')
        cy.get(radio).eq(4).should('be.focused').and('not.be.disabled')
        cy.get('.' + block + '__group').should('have.attr', 'aria-readonly', 'true')
        cy.then(() => { expect(model.value).to.equal(3) })
    })

    it('tracks disabled, required, visibility, prefill, and reset model changes', () => {
        cy.then(() => { model.enabled = false })
        cy.get(radio).should('be.disabled')
        cy.then(() => { model.enabled = true; model.required = true; model.value = 5 })
        cy.get(radio).should('not.be.disabled').and('have.attr', 'required')
        cy.get('.' + block + '__clear').should('not.be.visible')
        cy.get(radio).eq(4).should('be.checked')
        cy.then(() => { form.dispatch({type: 'reset'}) })
        cy.get(radio + ':checked').should('not.exist')
        cy.then(() => { model.visible = false })
        cy.get('#rating').should('not.be.visible')
    })

    it('announces errors and validates required, range, and whole-number constraints', () => {
        cy.then(() => { model.required = true; form.validate() })
        cy.get('.' + block + '__group').should('have.attr', 'aria-invalid', 'true')
        cy.get('.' + block + '__errormessage').should('not.be.empty').and('have.attr', 'aria-live', 'assertive')
        cy.get(radio).first().should('have.attr', 'aria-describedby').and('match', /errormessage/)
        cy.then(() => {
            model.value = 8
            expect(form.validate().length).to.be.greaterThan(0)
            model.value = 2.5
            expect(form.validate().length).to.be.greaterThan(0)
            model.value = 4
            expect(form.validate()).to.have.length(0)
        })
        cy.get('.' + block + '__group').should('have.attr', 'aria-invalid', 'false')
    })

    it('isolates renamed/repeated instances and labels hidden titles', () => {
        cy.then(() => {
            view.setId('rating-instance-2')
            view.syncMarkupWithModel()
            model.label = {value: 'Experience rating', visible: false}
        })
        cy.get(radio).should('have.attr', 'name', 'rating-instance-2-rating')
        cy.get('.' + block + '__group').should('have.attr', 'aria-label', 'Experience rating')
        cy.get('.' + block + '__group').should('not.have.attr', 'aria-labelledby')
        cy.get('.' + block + '__label').should('not.be.visible')
    })

    it('toggles shared help content and preserves its focus and ARIA behavior', () => {
        cy.get('.' + block + '__longdescription').should('not.be.visible')
        cy.get('.' + block + '__questionmark').click()
        cy.get('.' + block + '__longdescription').should('be.visible').and('have.attr', 'aria-live', 'polite')
        cy.get('.' + block + '__questionmark').should('have.attr', 'aria-expanded', 'true')
        cy.get('.' + block + '__questionmark').should('have.attr', 'aria-controls', 'rating__longdescription')
        cy.get('.' + block + '__questionmark').focus()
        cy.get('.' + block + '__questionmark').should('have.css', 'outline-width', '2px')
        cy.get('.' + block + '__questionmark').click()
        cy.get('.' + block + '__longdescription').should('not.be.visible')
    })
})
