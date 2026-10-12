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
package com.rdepoc.core.models.forms;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.jar.Attributes;
import java.util.jar.Manifest;

import org.apache.sling.api.resource.Resource;
import org.apache.sling.models.factory.ModelFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import com.adobe.cq.export.json.ComponentExporter;
import com.adobe.cq.forms.core.components.models.form.BaseConstraint;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rdepoc.core.testcontext.AppAemContext;

import io.wcm.testing.mock.aem.junit5.AemContext;
import io.wcm.testing.mock.aem.junit5.AemContextExtension;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(AemContextExtension.class)
class StarRatingImplTest {
    private final AemContext context = AppAemContext.newAemContext();

    @BeforeEach
    void setUp() {
        context.addModelsForClasses(StarRatingImpl.class);
        context.load().json("/form/starrating/test-content.json", "/content");
    }

    private StarRating resourceModel(String name) {
        return context.resourceResolver().getResource("/content/" + name).adaptTo(StarRating.class);
    }

    @Test
    void bundleExportsHtlModelPackageAndRegistersImplementation() throws Exception {
        Path classes = Path.of(StarRating.class.getProtectionDomain().getCodeSource().getLocation().toURI());
        try (InputStream stream = Files.newInputStream(classes.resolve("META-INF/MANIFEST.MF"))) {
            Attributes headers = new Manifest(stream).getMainAttributes();
            assertEquals("rdepoc.core", headers.getValue("Bundle-SymbolicName"));
            assertTrue(headers.getValue("Export-Package").contains(
                    StarRating.class.getPackageName() + ";version="),
                    "HTL's Java compiler requires the StarRating package to be exported");
            assertTrue(Arrays.asList(headers.getValue("Sling-Model-Classes").split(",")).contains(
                    StarRatingImpl.class.getName()));
        }
    }

    @Test
    void resourceAdaptationAndConstraints() {
        StarRating rating = resourceModel("rating");
        assertNotNull(rating);
        assertEquals("number-input", rating.getFieldType());
        assertEquals(BaseConstraint.Type.INTEGER, rating.getType());
        assertEquals(1, rating.getStep());
        assertEquals("experienceRating", rating.getName());
        assertEquals("Experience rating", rating.getLabel().getValue());
        assertEquals(1L, rating.getMinimum());
        assertEquals(7L, rating.getMaximum());
        assertEquals(1L, rating.getMinimumNumber());
        assertEquals(7L, rating.getMaximumNumber());
        assertEquals(Arrays.asList(1, 2, 3, 4, 5, 6, 7), rating.getStarValues());
        assertArrayEquals(new Object[] {3}, rating.getDefault());
        assertEquals(3, rating.getSelectedRating());
        assertTrue(rating.isRequired());
        assertTrue(rating.isVisible());
        assertTrue(rating.isEnabled());
        assertFalse(rating.isReadOnly());
    }

    @Test
    void requestAndExporterAdaptation() {
        context.currentResource("/content/rating");
        StarRating rating = context.request().adaptTo(StarRating.class);
        assertNotNull(rating);
        assertEquals(7L, rating.getMaximum());
        ComponentExporter exporter = context.request().adaptTo(ComponentExporter.class);
        assertNotNull(exporter);
        assertEquals(FormConstants.RT_FD_FORM_STAR_RATING_V1, exporter.getExportedType());
        assertNotNull(context.currentResource().adaptTo(ComponentExporter.class));
    }

    @Test
    void missingPropertiesUseFiveStarsAndNoRating() {
        StarRating rating = resourceModel("empty");
        assertNotNull(rating);
        assertEquals(5L, rating.getMaximum());
        assertNull(rating.getDefault());
        assertEquals(0, rating.getSelectedRating());
        assertFalse(rating.isRequired());
        assertFalse(rating.isReadOnly());
        assertTrue(rating.isVisible());
        assertTrue(rating.isEnabled());
    }

    @Test
    void inheritedStatesArePreserved() {
        StarRating rating = resourceModel("readonly");
        assertTrue(rating.isReadOnly());
        assertFalse(rating.isEnabled());
        assertFalse(rating.isVisible());
    }

    @Test
    void emptyAuthoredDefaultMeansNoRating() {
        Resource resource = context.create().resource("/content/blank",
                "sling:resourceType", FormConstants.RT_FD_FORM_STAR_RATING_V1, "name", "blank", "default", "");
        StarRating rating = resource.adaptTo(StarRating.class);
        assertNotNull(rating);
        assertNull(rating.getDefault());
        assertEquals(0, rating.getSelectedRating());
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-1", "2.5", "invalid", "2147483648"})
    void invalidMaximumFailsAdaptation(String maximum) {
        Resource resource = context.create().resource("/content/invalid",
                "sling:resourceType", FormConstants.RT_FD_FORM_STAR_RATING_V1,
                "name", "invalidMaximum", "maximum", maximum);
        ModelFactory factory = context.getService(ModelFactory.class);
        RuntimeException failure = assertThrows(RuntimeException.class,
                () -> factory.createModel(resource, StarRating.class));
        assertConfigurationFailure(failure);
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-1", "6", "2.5", "invalid"})
    void invalidDefaultFailsAdaptation(String value) {
        Resource resource = context.create().resource("/content/invalid",
                "sling:resourceType", FormConstants.RT_FD_FORM_STAR_RATING_V1,
                "name", "invalidDefault", "default", value);
        ModelFactory factory = context.getService(ModelFactory.class);
        RuntimeException failure = assertThrows(RuntimeException.class,
                () -> factory.createModel(resource, StarRating.class));
        assertConfigurationFailure(failure);
    }

    private void assertConfigurationFailure(Throwable failure) {
        while (failure.getCause() != null && !(failure instanceof IllegalArgumentException)) {
            failure = failure.getCause();
        }
        assertTrue(failure instanceof IllegalArgumentException, failure.toString());
        assertTrue(failure.getMessage().contains("maximum") || failure.getMessage().contains("default"),
                failure.getMessage());
    }

    @Test
    void jsonExportUsesNumericSchemaAndOmitsRenderingHelpers() throws Exception {
        ObjectMapper mapper = new ObjectMapper().setSerializationInclusion(JsonInclude.Include.NON_NULL);
        JsonNode actual = mapper.readTree(mapper.writeValueAsString(resourceModel("rating")));
        try (InputStream fixture = getClass().getResourceAsStream("/form/starrating/exporter-starrating.json")) {
            JsonNode expected = mapper.readTree(fixture);
            expected.fields().forEachRemaining(entry ->
                    assertEquals(entry.getValue(), actual.get(entry.getKey()), entry.getKey()));
        }
        assertFalse(actual.has("starValues"));
        assertFalse(actual.has("selectedRating"));
        assertFalse(actual.has("maximumNumber"));
        assertFalse(actual.has("minimumNumber"));
        assertFalse(actual.has("exclusiveMaximum"));
        assertFalse(actual.has("exclusiveMinimum"));
    }
}
