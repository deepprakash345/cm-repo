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

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import javax.annotation.PostConstruct;

import org.apache.sling.api.SlingHttpServletRequest;
import org.apache.sling.api.resource.Resource;
import org.apache.sling.models.annotations.Exporter;
import org.apache.sling.models.annotations.Model;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.adobe.cq.export.json.ComponentExporter;
import com.adobe.cq.export.json.ExporterConstants;
import com.adobe.cq.forms.core.components.models.form.FieldType;
import com.adobe.cq.forms.core.components.util.AbstractFieldImpl;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Model(adaptables = {SlingHttpServletRequest.class, Resource.class},
        adapters = {StarRating.class, ComponentExporter.class},
        resourceType = FormConstants.RT_FD_FORM_STAR_RATING_V1)
@Exporter(name = ExporterConstants.SLING_MODEL_EXPORTER_NAME,
        extensions = ExporterConstants.SLING_MODEL_EXTENSION)
public class StarRatingImpl extends AbstractFieldImpl implements StarRating {
    private static final Logger LOG = LoggerFactory.getLogger(StarRatingImpl.class);
    private int starCount;

    @PostConstruct
    private void initStarRating() {
        try {
            starCount = maximumAsStr == null ? 5 : new BigDecimal(maximumAsStr).intValueExact();
            if (starCount < 1) {
                throw new IllegalArgumentException("maximum must be a positive whole number");
            }
            if (defaultValue != null && (defaultValue.length == 0 ||
                    (defaultValue.length == 1 && (defaultValue[0] == null ||
                    defaultValue[0].toString().trim().isEmpty())))) {
                defaultValue = null;
            }
            if (defaultValue != null) {
                if (defaultValue.length != 1) {
                    throw new IllegalArgumentException("default must contain a single rating");
                }
                int rating = new BigDecimal(defaultValue[0].toString()).intValueExact();
                if (rating < 1 || rating > starCount) {
                    throw new IllegalArgumentException("default must be between 1 and maximum");
                }
                defaultValue = new Object[] {rating};
            }
        } catch (ArithmeticException | NumberFormatException ex) {
            LOG.error("Invalid Star Rating maximum or default: expected whole numbers", ex);
            throw new IllegalArgumentException("Star Rating maximum and default must be whole numbers", ex);
        } catch (IllegalArgumentException ex) {
            LOG.error("Invalid Star Rating configuration: {}", ex.getMessage());
            throw ex;
        }
    }

    @Override
    public String getFieldType() {
        return FieldType.NUMBER_INPUT.getValue();
    }

    @Override
    public Type getType() {
        return Type.INTEGER;
    }

    @Override
    public int getStep() {
        return 1;
    }

    @Override
    public Long getMinimum() {
        return 1L;
    }

    @Override
    public Long getMaximum() {
        return (long) starCount;
    }

    @Override
    public Number getMinimumNumber() {
        return getMinimum();
    }

    @Override
    public Number getMaximumNumber() {
        return getMaximum();
    }

    @Override
    @JsonIgnore
    public int getSelectedRating() {
        return defaultValue == null ? 0 : ((Number) defaultValue[0]).intValue();
    }

    @Override
    @JsonIgnore
    public List<Integer> getStarValues() {
        return IntStream.rangeClosed(1, starCount).boxed().collect(Collectors.toList());
    }
}
