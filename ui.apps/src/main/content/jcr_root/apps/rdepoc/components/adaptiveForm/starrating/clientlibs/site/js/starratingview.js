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
(function () {
    "use strict";

    const block = "cmp-adaptiveform-starrating";

    class StarRating extends FormView.FormFieldBase {
        static IS = "adaptiveFormStarRating";

        find(element) {
            return this.element.querySelector("." + block + "__" + element);
        }

        getWidget() { return this.find("widget"); }
        getLabel() { return this.find("label"); }
        getDescription() { return this.find("longdescription"); }
        getTooltipDiv() { return this.find("shortdescription"); }
        getErrorDiv() { return this.find("errormessage"); }
        getQuestionMarkDiv() { return this.find("questionmark"); }

        getRadios() {
            return Array.from(this.element.querySelectorAll("." + block + "__radio"));
        }

        isInteractive() {
            return this.element.getAttribute("data-cmp-enabled") !== "false" &&
                this.element.getAttribute("data-cmp-readonly") !== "true";
        }

        setModel(model) {
            super.setModel(model);
            if (this.getQuestionMarkDiv()) {
                this.getQuestionMarkDiv().type = "button";
            }
            this.find("group").addEventListener("change", (event) => {
                if (event.target.matches("." + block + "__radio")) {
                    if (this.isInteractive()) {
                        this.setModelValue(Number(event.target.value));
                    } else {
                        this.updateValue(this.getModel().value);
                    }
                }
            });
            ["click", "keydown"].forEach((type) => {
                this.find("group").addEventListener(type, (event) => {
                    const selectionKey = [" ", "Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
                    if (!this.isInteractive() && (type === "click" || selectionKey.includes(event.key))) {
                        event.preventDefault();
                    } else if (type === "keydown" && event.target.matches("." + block + "__radio")) {
                        this.selectWithKeyboard(event);
                    }
                }, true);
            });
            this.element.addEventListener("focusin", (event) => {
                if (!this.element.contains(event.relatedTarget)) {
                    this.setActive();
                    this.triggerEnter();
                    this.getWidget().dispatchEvent(new FocusEvent("focus", {relatedTarget: event.relatedTarget}));
                }
            });
            this.element.addEventListener("focusout", (event) => {
                if (!this.element.contains(event.relatedTarget)) {
                    this.setInactive();
                    this.triggerExit();
                }
            });
            this.find("clear").addEventListener("click", () => {
                if (this.isInteractive() && this.element.getAttribute("data-cmp-required") !== "true") {
                    this.setModelValue(null);
                }
            });
            this.syncControls();
        }

        selectWithKeyboard(event) {
            const radios = this.getRadios();
            const index = radios.indexOf(event.target);
            const rtl = getComputedStyle(this.find("group")).direction === "rtl";
            const offsets = {ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1,
                ArrowDown: 1, ArrowUp: -1};
            let next;
            if (Object.prototype.hasOwnProperty.call(offsets, event.key)) {
                next = (index + offsets[event.key] + radios.length) % radios.length;
            } else if (event.key === "Home") {
                next = 0;
            } else if (event.key === "End") {
                next = radios.length - 1;
            } else if (event.key === " " || event.key === "Enter") {
                next = index;
            } else {
                return;
            }
            event.preventDefault();
            if (this.isInteractive()) {
                radios[next].focus();
                this.setModelValue(Number(radios[next].value));
            }
        }

        updateValue(value) {
            super.updateValue(value == null ? "" : value);
            this.getRadios().forEach((radio) => {
                radio.checked = value != null && value !== "" && Number(radio.value) === Number(value);
                radio.parentElement.setAttribute("data-filled",
                    value != null && value !== "" && Number(radio.value) <= Number(value));
            });
        }

        updateEnabled(enabled) {
            super.updateEnabled(enabled);
            this.syncControls();
        }

        updateReadOnly(readOnly) {
            super.updateReadOnly(readOnly);
            this.getWidget().setAttribute("aria-readonly", Boolean(readOnly));
            this.find("group").setAttribute("aria-readonly", Boolean(readOnly));
            this.syncControls();
        }

        updateRequired(required, state) {
            super.updateRequired(required, state);
            this.find("group").setAttribute("aria-required", Boolean(required));
            this.getRadios().forEach((radio) => { radio.required = Boolean(required); });
            this.find("clear").hidden = Boolean(required);
        }

        updateValidity(validity, state) {
            super.updateValidity(validity, state);
            this.find("group").setAttribute("aria-invalid", !validity.valid);
            this.syncDescriptions();
            this.getRadios().forEach((radio) => { radio.setAttribute("aria-invalid", !validity.valid); });
        }

        updateLabel(label) {
            super.updateLabel(label);
            const group = this.find("group");
            const screenReaderText = this.getModel().screenReaderText;
            if (this.getLabel() && label.visible !== false && !screenReaderText) {
                group.setAttribute("aria-labelledby", this.getId() + "__label");
                group.removeAttribute("aria-label");
            } else {
                group.removeAttribute("aria-labelledby");
                const text = screenReaderText || label.value || this.getModel().name;
                group.setAttribute("aria-label", window.DOMPurify ?
                    window.DOMPurify.sanitize(text, {ALLOWED_TAGS: []}) : text);
            }
        }

        syncControls() {
            const enabled = this.element.getAttribute("data-cmp-enabled") !== "false";
            this.getRadios().forEach((radio) => { radio.disabled = !enabled; });
            this.find("group").setAttribute("aria-disabled", !enabled);
            this.find("clear").disabled = !this.isInteractive();
        }

        syncDescriptions() {
            const descriptions = ["shortdescription", "longdescription", "errormessage"]
                .filter((part) => this.find(part))
                .map((part) => this.getId() + "__" + part).join(" ");
            this.find("group").setAttribute("aria-describedby", descriptions);
            this.getRadios().forEach((radio) => { radio.setAttribute("aria-describedby", descriptions); });
            if (this.getQuestionMarkDiv()) {
                this.getQuestionMarkDiv().setAttribute("aria-controls", this.getId() + "__longdescription");
            }
        }

        syncMarkupWithModel() {
            super.syncMarkupWithModel();
            const label = this.element.querySelector("[id$='__label']");
            label.id = this.getId() + "__label";
            this.getRadios().forEach((radio) => { radio.name = this.getId() + "-rating"; });
            this.updateLabel(this.getModel().getState().label);
            this.syncDescriptions();
        }

        setFocus() {
            const radios = this.getRadios();
            const target = radios.find((radio) => radio.checked) || radios[0];
            if (target && !target.disabled) {
                target.focus();
            }
        }
    }

    FormView.Utils.setupField(({element, formContainer}) =>
        new StarRating({element, formContainer}), '[data-cmp-is="' + StarRating.IS + '"]');
}());
